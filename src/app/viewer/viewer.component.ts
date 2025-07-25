import { Component, OnInit,AfterViewInit, NgZone, ElementRef } from '@angular/core';
import { ManifestService } from '../manifest.service';
import { AnnotationsService } from '../annotations.service';
import { AnimationsService } from '../animations.service';
import { CanvasDatum } from '../canvas-datum';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
declare var OpenSeadragon: any;

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent implements OnInit,  AfterViewInit {
  viewer: any;
  panelText: string = "";
  canvasData: CanvasDatum[] = [];
  annotations: any[] = [];
  animations: any[] = [];
  allAnimations: any[] = [];
  pageIndex: number = 0;
  panelTextIndex: number = 0;
  panelTitle: string = 'Annotation Details';
  showingVideoTour: boolean = false;
  currentAnnotationIndex: number = 0;
  numPanels: number = 0;
  showingAnimations: boolean = false;
  showingAnnotations: boolean = true;
  animationIndex: number = 0;
  numAnimations: number = 0;
  private videoOverlays: any[] = [];
  private annotationOverlays: any[] = [];
  private currentVideo: HTMLVideoElement | null = null;
  isPlaying: boolean = false;
  annotationImages: string[] = [];
  videoProgress: number = 0;
  videoDuration: number = 0;
  dragPosition = { x: 0, y: 0 };

  constructor(
    private ngZone: NgZone, 
    private manifestService: ManifestService, 
    private annotationsService: AnnotationsService, 
    private animationsService: AnimationsService
  ) { }

  ngOnInit() {
    // Keep this empty or only put non-DOM related initialization here
  }

  ngAfterViewInit() {
    // Increase the delay and add element check
    setTimeout(() => {
      const viewerElement = document.getElementById('seadragon-viewer');
      if (viewerElement) {
        this.initializeViewer();
      } else {
        console.error('Seadragon viewer element not found');
        // Try again with longer delay
        setTimeout(() => {
          this.initializeViewer();
        }, 500);
      }
    }, 200);
  }

  onDragEnded(event: CdkDragEnd) {
    // Store the final position to prevent snap-back
    this.dragPosition = event.source.getFreeDragPosition();
  }

  private initializeViewer() {
    // Check if element exists before proceeding
    const viewerElement = document.getElementById('seadragon-viewer');
    if (!viewerElement) {
      console.error('Seadragon viewer element not found');
      return;
    }

    this.manifestService.getData().subscribe(res => {
      console.log('Canvas data received:', res); // Debug log
      
      // Check if res is an array, if not, extract the array
      let canvasArray = Array.isArray(res) ? res : res.sequences?.[0]?.canvases || [];
      this.canvasData = canvasArray;
      
      if (!Array.isArray(this.canvasData) || this.canvasData.length === 0) {
        console.error('No valid canvas data found:', res);
        return;
      }
      
      // Create tile sources array
      let tileSources: any[] = [];
      this.canvasData.forEach((element: any) => { // Explicitly type as any
        console.log('Processing canvas element:', element); // Debug log
        
        // Try different possible paths for the image service
        let imageServiceUrl = '';
        
        // Try the standard IIIF structure
        if (element.images && element.images[0] && element.images[0].resource && element.images[0].resource.service) {
          const service = element.images[0].resource.service;
          imageServiceUrl = service["@id"] || service.id;
        }
        // Try alternative structure with items
        else if (element.items && element.items[0] && element.items[0].items && element.items[0].items[0]) {
          const annotation = element.items[0].items[0];
          if (annotation.body && annotation.body.service) {
            const service = annotation.body.service;
            imageServiceUrl = service["@id"] || service.id;
          }
        }
        // Try direct imageServiceId property
        else if (element.imageServiceId) {
          imageServiceUrl = element.imageServiceId;
        }
        // Try imageApiId property (common in some manifests)
        else if (element.imageApiId) {
          imageServiceUrl = element.imageApiId;
        }
        // Try @id property directly
        else if (element['@id']) {
          imageServiceUrl = element['@id'];
        }
        else {
          console.warn('Could not find image service URL for element:', element);
          return;
        }
        
        if (imageServiceUrl) {
          // Ensure the URL doesn't already end with /info.json
          const infoUrl = imageServiceUrl.endsWith('/info.json') ? imageServiceUrl : imageServiceUrl + "/info.json";
          tileSources.push(infoUrl);
          console.log('Added tile source:', infoUrl); // Debug log
        }
      });

      if (tileSources.length === 0) {
        console.error('No tile sources created');
        return;
      }

      console.log('Final tile sources:', tileSources); // Debug log

      // Initialize OpenSeadragon viewer
      try {
        this.viewer = new OpenSeadragon.Viewer({
          id: "seadragon-viewer",
          homeButton: "home",
          fullPageButton: "full-page",
          nextButton: "next",
          previousButton: "previous",
          sequenceMode: true,
          showHomeControl: true,
          blendTime: 0.5,
          springStiffness: 6.5,       
          animationTime: 1.5,         
          immediateRender: false, 
          showZoomControl: false,
          showFullPageControl: true,
          showRotationControl: false,
          showFlipControl: false,
          showSequenceControl: true,
          navigatorBackground: "black",
          backgroundColor: 'black',
          prefixUrl: "//openseadragon.github.io/openseadragon/images/",
          tileSources: tileSources
        });

        // Also set the canvas element background color directly
        this.viewer.addHandler('open', () => {
          const canvas = this.viewer.canvas;
          if (canvas) {
            canvas.style.backgroundColor = 'black';
          }
        });
        
        console.log('OpenSeadragon viewer initialized successfully');

        // Load annotations and animations after viewer is created
        this.loadAnnotationsAndAnimations();

      } catch (error) {
        console.error('Error initializing OpenSeadragon viewer:', error);
      }
    },
    error => {
      console.error("Error loading manifest data:", error);
    });
  }

  private loadAnnotationsAndAnimations() {
    // Fetch annotation data
    this.annotationsService.getData().subscribe(res => {
      this.annotations = res;
      this.addAnnotations(this.annotations);
    });

    // Fetch animation data
    this.animationsService.getData().subscribe(res => {
      this.allAnimations = res;  // Store all animations here
      this.animations = res;     // Keep this for backward compatibility
      this.numAnimations = this.animations.length;
    });

    // Handle page changes
    this.viewer.addHandler('page', (event: any) => {
      this.pageIndex = event.page;
      this.panelText = "";
      console.log("now on page ", this.pageIndex);
      this.addAnnotations(this.annotations);
      
      // Update animations for new page if showing animations
      if (this.showingAnimations) {
        this.removeAnimations();
        this.animations = this.allAnimations.filter(anim => anim.canvasIndex === this.pageIndex);
        this.numAnimations = this.animations.length;
        this.animationIndex = 0;
        this.showAllAnimations();
      }
    });

    this.viewer.addHandler('open', function () {
      console.log("Viewer opened successfully");
    });
  }

  move(x: number, y: number, width: number, height: number) {
    var box = new OpenSeadragon.Rect(x - (width / 2), y - (width / 2), width, height);
    this.viewer.viewport.fitBounds(box);
  }

  addAnimations(data: any[]) {
    console.log("adding animation hotspots");
    console.log(data);
    var index = 0;
    data.forEach(element => {
      if (element.canvasIndex == this.pageIndex) {
        this.addVideoOverlay(element.x, element.y, element.videoUrl, element.width, element.height, element.hideControls);
      }
      index++;
    });
  }

  addAnnotations(data: any[]) {
    console.log("adding annotation hotspots");
    var index = 0;
    let titles: string[] = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];

    data.forEach(element => {
      if (titles.indexOf(element["painting title"]) == this.pageIndex) {
        this.addAnnotation(element.x, element.y, index, element["annotation type"]);
      }
      index++;
    });
  }

  addAnnotation(x: number, y: number, index: number, type: string) {
    var elt = document.createElement("div");
    elt.className = "annotation-pin";
    
    if (type === "multi-level") {
      elt.classList.add("multi-level");
    } else {
      elt.classList.add("single-level");
    }

    elt.id = "annotation_" + index;
    elt.style.cursor = "pointer";
    
    // Apply inline styles for immediate effect
    elt.style.width = "1px";
    elt.style.height = "1px";
    elt.style.borderRadius = "50%";
    elt.style.position = "relative";
    elt.style.transition = "all 0.1s ease";
    
    // Add the visual styling based on type
    if (type === "multi-level") {
      elt.style.background = "radial-gradient(circle, rgba(0, 0, 0, 0) 36%, rgb(255, 167, 15) 40%,  rgb(255, 169, 20) 50%, rgba(0, 0, 0, 0) 54%)";
    } else {
      elt.style.background = "radial-gradient(circle,rgba(0, 0, 0, 0) 36%, rgb(15, 179, 255) 40%,  rgb(15, 179, 255) 50%, rgba(0, 0, 0, 0) 54%)";
    }

        // Create tooltip element
    var tooltip = document.createElement("div");
    tooltip.innerHTML = this.annotations[index]["annotation title"] || "Annotation";
    tooltip.style.position = "absolute";
    tooltip.style.bottom = "100%";
    tooltip.style.left = "50%";
    tooltip.style.transform = "translateX(-50%)";
    tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
    tooltip.style.color = "white";
    tooltip.style.padding = "8px 12px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.fontSize = "14px";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.opacity = "0";
    tooltip.style.pointerEvents = "none";
    tooltip.style.transition = "opacity 0.3s ease";
    tooltip.style.zIndex = "10000";
    tooltip.style.marginBottom = "8px";
    
    // Add arrow to tooltip
    var arrow = document.createElement("div");
    arrow.style.position = "absolute";
    arrow.style.top = "100%";
    arrow.style.left = "50%";
    arrow.style.marginLeft = "-5px";
    arrow.style.width = "0";
    arrow.style.height = "0";
    arrow.style.borderLeft = "5px solid transparent";
    arrow.style.borderRight = "5px solid transparent";
    arrow.style.borderTop = "5px solid rgba(0, 0, 0, 0.9)";
    
    tooltip.appendChild(arrow);
    elt.appendChild(tooltip);
    
    this.currentAnnotationIndex = index;
    
    this.viewer.addOverlay({
      element: elt,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: 0.02,
      height: 0.02,
      index: index
    });

    // Track this annotation overlay for reliable removal
    this.annotationOverlays.push(elt);

    // Add hover effects using JavaScript since CSS might not penetrate OpenSeadragon
    elt.addEventListener('mouseenter', () => {
      elt.style.transform = "scale(1.6)";
      tooltip.style.opacity = "1";
      if (type === "multi-level") {
        elt.style.boxShadow = "0 0 10px rgba(255, 169, 24, 0.8)";
        elt.style.animation = "pulse-multi 1.5s infinite";
      } else {
        elt.style.boxShadow = "0 0 10px rgba(15, 179, 255, 0.8)";
        elt.style.animation = "pulse 1.5s infinite";
      }
    });
    
    elt.addEventListener('mouseleave', () => {
      elt.style.transform = "scale(1)";
      elt.style.animation = "none";
      tooltip.style.opacity = "0";
      if (type === "multi-level") {
        elt.style.boxShadow = "0 0 10px rgba(255, 169, 24, 0)";
      } else {
        elt.style.boxShadow = "0 0 10px rgba(15, 179, 255, 0)";
      }
    });

    new OpenSeadragon.MouseTracker({
      element: elt,
      clickHandler: e => this.setAnnotation(index),
    });

    this.panelTextIndex = 0;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 0"].length > 0) this.numPanels = 1;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 1"].length > 0) this.numPanels = 2;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 2"].length > 0) this.numPanels = 3;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 3"].length > 0) this.numPanels = 4;
  }

  addVideoOverlay(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: true,
      moveToOnLoad: true,
      playNextOnEnd: true,
      storeAsCurrentVideo: false
    });
  }

  removeAnnotations() {
    // Remove all tracked annotation overlays
    this.annotationOverlays.forEach(annotationElement => {
      this.viewer.removeOverlay(annotationElement);
    });
    // Clear the tracking array
    this.annotationOverlays = [];
  }

  removeAnimations() {
    // Clear current video reference
    this.currentVideo = null;
    
    // Remove all tracked video overlays
    this.videoOverlays.forEach(video => {
      this.viewer.removeOverlay(video);
    });
    // Clear the tracking array
    this.videoOverlays = [];
  }

  setAnnotation(index: number) {
    this.panelText = this.formatPanelText(this.annotations[index]["annotation text 0"]);
    this.currentAnnotationIndex = index;
    this.panelTitle = this.annotations[index]["annotation title"] || 'Annotation Details';

    // Determine how many panels there are
    this.numPanels = 0;
    if (this.annotations[index]["annotation text 0"].length > 0) this.numPanels = 1;
    if (this.annotations[index]["annotation text 1"].length > 0) this.numPanels = 2;
    if (this.annotations[index]["annotation text 2"].length > 0) this.numPanels = 3;
    if (this.annotations[index]["annotation text 3"].length > 0) this.numPanels = 4;
    
    // Collect annotation images
    this.annotationImages = [];

    // Get images for the current panel (initially panel 0)
    this.updateImagesForCurrentPanel();

    this.panelTextIndex = 0;
  }

 formatPanelText(text: string): string {
    // If the text already contains HTML links, return as-is
    if (text.includes('<a ') || text.includes('href=')) {
      return text;
    }
    
    // Convert plain URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let formattedText = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert email addresses to clickable links
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
    formattedText = formattedText.replace(emailRegex, '<a href="mailto:$1">$1</a>');
    
    return formattedText;
  }

  jumpToAnimation(index: number) {
    console.log("jumping to animation #", index);
    this.animationIndex = index;
  }

  setAnimation() {
    // Animation logic here
  }

  // New methods for the template functionality
  toggleAnnotations(show: boolean) {
    this.showingAnnotations = show;
    if (show) {
      this.addAnnotations(this.annotations);
    } else {
      this.removeAnnotations();
    }
  }

  toggleAnimations(show: boolean) {
    this.showingAnimations = show;
    if (show) {
      // Filter animations for current page
      this.animations = this.allAnimations.filter(anim => anim.canvasIndex === this.pageIndex);
      this.numAnimations = this.animations.length;
      this.animationIndex = 0;
      
      console.log('Animations for page', this.pageIndex, ':', this.animations);
      console.log('Number of animations:', this.numAnimations);
      
      // Show all animations by default (not playing)
      this.showAllAnimations();
    } else {
      this.removeAnimations();
    }
  }

  updateImagesForCurrentPanel() {
    this.annotationImages = [];
    
    // Get images for the current panel
    const imageFilename = this.annotations[this.currentAnnotationIndex][`image filename ${this.panelTextIndex}`];
    if (imageFilename && imageFilename.trim() !== '') {
      this.annotationImages.push(`assets/panelImages/${imageFilename}`);
    }
  }

  previousPanel() {
    if (this.panelTextIndex > 0) {
      this.panelTextIndex--;
      this.panelText = this.formatPanelText(
        this.annotations[this.currentAnnotationIndex][`annotation text ${this.panelTextIndex}`]
      );
    }
    // Update images for the new panel
    this.updateImagesForCurrentPanel();
  }

  nextPanel() {
    if (this.panelTextIndex < this.numPanels - 1) {
      this.panelTextIndex++;
      this.panelText = this.formatPanelText(
        this.annotations[this.currentAnnotationIndex][`annotation text ${this.panelTextIndex}`]
      );
    }
    // Update images for the new panel
    this.updateImagesForCurrentPanel();
  }

  previousAnimation() {
    if (this.animationIndex > 0) {
      const wasPlaying = this.isPlaying; // Store current play state
      this.animationIndex--;
      
      if (wasPlaying) {
        // If was playing, show only current animation and play it
        this.showCurrentAnimation();
        setTimeout(() => {
          this.playCurrentAnimation();
        }, 100);
      } else {
        // If was not playing, show all animations but still move to it
        this.showAllAnimations();
        this.moveToAnimation(this.animationIndex);
      }
    }
  }

  nextAnimation() {
    if (this.animationIndex < this.numAnimations - 1) {
      const wasPlaying = this.isPlaying; // Store current play state
      this.animationIndex++;
      
      if (wasPlaying) {
        // If was playing, show only current animation and play it
        this.showCurrentAnimation();
        setTimeout(() => {
          this.playCurrentAnimation();
        }, 100);
      } else {
        // If was not playing, show all animations but still move to it
        this.showAllAnimations();
        this.moveToAnimation(this.animationIndex);
      }
    }
  }

  playCurrentAnimation() {
    console.log('Play animation called');
    console.log('Animations array:', this.animations);
    console.log('Animation index:', this.animationIndex);
    console.log('Num animations:', this.numAnimations);
    
    if (this.currentVideo) {
      // If there's a current video, toggle its play/pause state
      if (this.currentVideo.paused) {
        // Remove all animations and show only the current one playing
        this.removeAnimations();
        this.showCurrentAnimation();
        setTimeout(() => {
          if (this.currentVideo) {
            this.currentVideo.play().catch(error => {
              console.warn('Play failed:', error);
            });
            this.isPlaying = true;
            
            // Move and zoom to animation location
            this.moveToAnimation(this.animationIndex);
          }
        }, 100);
      } else {
        // Pause current video and show all animations
        this.currentVideo.pause();
        this.isPlaying = false;
        this.showAllAnimations();
      }
    } else {
      // No current video, so remove all and show current animation playing
      this.removeAnimations();
      this.showCurrentAnimation();
      setTimeout(() => {
        if (this.currentVideo) {
          this.currentVideo.play().catch(error => {
            console.warn('Play failed:', error);
          });
          this.isPlaying = true;
          
          // Move and zoom to animation location
          this.moveToAnimation(this.animationIndex);
        }
      }, 100);
    }
  }

  moveToAnimation(index: number) {
    if (this.animations.length > 0 && index < this.animations.length) {
      const animation = this.animations[index];
      
      // Calculate the bounds for the animation with some padding
      const padding = 0.1; // Add 10% padding around the animation
      const bounds = new OpenSeadragon.Rect(
        animation.x - (animation.width / 2) - padding,
        animation.y - (animation.height / 2) - padding,
        animation.width + (padding * 2),
        animation.height + (padding * 2)
      );
      
      // Smoothly pan and zoom to the animation
      this.viewer.viewport.fitBounds(bounds, false);
    }
  }

  private showAllAnimations() {
    // Remove existing overlays first
    this.removeAnimations();
    this.isPlaying = false;
    
    // Add all animations for current page (not playing)
    this.animations.forEach(animation => {
      this.addVideoOverlayForDisplay(
        animation.x,
        animation.y,
        animation.videoUrl,
        animation.width,
        animation.height,
        animation.hideControls
      );
    });
    
    // Reset current video reference since we're showing all
    this.currentVideo = null;
    this.isPlaying = false;
  }

  private showCurrentAnimation() {
    if (this.animations.length > 0 && this.animationIndex < this.animations.length) {
      const currentAnimation = this.animations[this.animationIndex];
      console.log('Showing animation:', currentAnimation);

      // Remove any existing video overlays first
      this.removeAnimations();
      
      this.addVideoOverlayForPlayback(
        currentAnimation.x, 
        currentAnimation.y, 
        currentAnimation.videoUrl, 
        currentAnimation.width, 
        currentAnimation.height,
        currentAnimation.hideControls
      );
    } else {
      console.log('No animations available or invalid index');
    }
  }

  addVideoOverlayForDisplay(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: false,
      storeAsCurrentVideo: false
    });
  }

  addVideoOverlayForPlayback(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    // Find the animation data to get navigation cues
    const animation = this.animations.find(anim => 
      anim.x === x && anim.y === y && anim.videoUrl === videoUrl
    );
    
    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: false,
      storeAsCurrentVideo: true,
      trackProgress: true,
      playNextOnEnd: true,
      navigationCues: animation?.navigationCues 
    });
  }

  addVideoOverlayWithSequence(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    // Find the animation data to get navigation cues
    const animation = this.animations.find(anim => 
      anim.x === x && anim.y === y && anim.videoUrl === videoUrl
    );
    
    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: true,
      moveToOnLoad: true,
      playNextOnEnd: true,
      storeAsCurrentVideo: true,
      navigationCues: animation?.navigationCues 
    });
  }

  playNextAnimationInSequence() {
    // Move to next animation
    if (this.animationIndex < this.numAnimations - 1) {
      this.animationIndex++;
      
      // Get the next animation
      const nextAnimation = this.animations[this.animationIndex];
      console.log('Playing next animation:', nextAnimation);
      
      // Remove current video overlay
      this.removeAnimations();
      
      // Add next video overlay
      this.addVideoOverlayWithSequence(
        nextAnimation.x, 
        nextAnimation.y, 
        nextAnimation.videoUrl, 
        nextAnimation.width, 
        nextAnimation.height,
        nextAnimation.hideControls
      );
      // Auto-play the next video after a short delay and maintain play state
      setTimeout(() => {
        if (this.currentVideo) {
          this.currentVideo.play().catch(error => {
            console.warn('Auto-play failed:', error);
          });
          this.isPlaying = true; // Maintain playing state
          
          // Move to the animation with smooth transition
          this.moveToAnimation(this.animationIndex);
        }
      }, 100);
    } else {
      console.log('All animations played, sequence complete');
      // Optionally reset to first animation or show all animations
      this.isPlaying = false;
      this.showAllAnimations();
    }
  }

  goBack() {
    this.showingAnimations = false;
    this.showingAnnotations = true;
  }

  stopVideoTour() {
    this.showingVideoTour = false;
    this.removeAnimations();
  }

  onImageError(event: any) {
    console.warn('Failed to load annotation image:', event.target.src);
    // Optionally hide the image or show a placeholder
    event.target.style.display = 'none';
  }

  private createVideoOverlay(x: number, y: number, videoUrl: string, width: number, height: number, options: {
    autoPlay?: boolean;
    hideControls?: boolean;
    storeAsCurrentVideo?: boolean;
    trackProgress?: boolean;
    moveToOnLoad?: boolean;
    playNextOnEnd?: boolean;
    navigationCues?: any[];
  } = {}) {
    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = false;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.cursor = "pointer";

    // Create play button overlay
    var playButton = document.createElement("div");
    playButton.innerHTML = "▶"; // Play icon
    playButton.style.position = "absolute";
    playButton.style.top = "50%";
    playButton.style.left = "50%";
    playButton.style.transform = "translate(-50%, -50%)";
    playButton.style.fontSize = "24px";
    playButton.style.color = "white";
    playButton.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    playButton.style.borderRadius = "50%";
    playButton.style.width = "60px";
    playButton.style.height = "60px";
    playButton.style.display = "flex";
    playButton.style.alignItems = "center";
    playButton.style.justifyContent = "center";
    playButton.style.opacity = "0";
    playButton.style.transition = "opacity 0.3s ease";
    playButton.style.cursor = "pointer";
    playButton.style.zIndex = "1000";
    playButton.style.paddingLeft = "2px";

    // Create container for video and play button
    var container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = "100%";
    container.style.height = "100%";
    container.appendChild(video);
    container.appendChild(playButton);

    // Track navigation cues if provided
    if (options.navigationCues && options.navigationCues.length > 0) {
      console.log('Navigation cues provided:', options.navigationCues);
      let currentCueIndex = 0;
      const navigationCues = options.navigationCues;

      video.addEventListener('timeupdate', () => {
        const currentTime = video.currentTime;
        
        // Check if we've reached the next navigation cue
        if (currentCueIndex < navigationCues.length) {
          const nextCue = navigationCues[currentCueIndex];
          
          if (currentTime >= nextCue.time) {
            console.log(`Navigation cue triggered at ${currentTime}s:`, nextCue.description);
            
            // Move the viewer to the specified location
            this.moveToLocation(nextCue.x, nextCue.y, nextCue.width, nextCue.height);
            
            currentCueIndex++;
          }
        }

        // Show preview of next navigation cue when we're 2 seconds away
        // if (currentCueIndex < navigationCues.length) {
        //   const nextCue = navigationCues[currentCueIndex];
        //   if (currentTime >= (nextCue.time - 2) && currentTime < nextCue.time) {
        //     // Only show the preview once per cue
        //     if (!nextCue.previewShown) {
        //       this.showNextNavigationCue(nextCue);
        //       nextCue.previewShown = true; // Mark as shown to prevent repeated calls
        //     }
        //   }
        // }

      });

      // Reset cue index when video starts over
      video.addEventListener('seeked', () => {
        currentCueIndex = navigationCues.findIndex(cue => cue.time > video.currentTime);
        if (currentCueIndex === -1) currentCueIndex = navigationCues.length;
      });
    }

    // Show/hide play button on hover
    container.addEventListener('mouseenter', () => {
      if (video.paused) {
        playButton.innerHTML = "▶"; // Play icon
        playButton.style.opacity = "1";
      } else {
        playButton.innerHTML = "⏸"; // Pause icon
        playButton.style.opacity = "1";
      }
    });

    container.addEventListener('mouseleave', () => {
      playButton.style.opacity = "0";
    });

    // Handle play button click using OpenSeadragon MouseTracker
    new OpenSeadragon.MouseTracker({
      element: playButton,
      clickHandler: (event: any) => {
        console.log('Play button clicked via MouseTracker!');
        event.preventDefaultAction = true;
        
        if (video.paused) {
          console.log('Playing video via MouseTracker');
          video.play().catch(error => {
            console.warn('Play failed:', error);
          });
          playButton.style.opacity = "0";
          if (options.storeAsCurrentVideo) {
            this.isPlaying = true;
          }
        } else {
          console.log('Pausing video via MouseTracker');
          video.pause();
          playButton.style.opacity = "1";
          if (options.storeAsCurrentVideo) {
            this.isPlaying = false;
          }
        }
        
        return false; // Prevent further event propagation
      }
    });

    // Store reference to current video if requested
    if (options.storeAsCurrentVideo) {
      this.currentVideo = video;
    }

    // Track video progress if requested
    if (options.trackProgress) {
      video.addEventListener('loadedmetadata', () => {
        this.videoDuration = video.duration;
      });

      video.addEventListener('timeupdate', () => {
        this.videoProgress = (video.currentTime / video.duration) * 100;
      });
    }

    // Update play button and state when video state changes
    video.addEventListener('play', () => {
      playButton.innerHTML = "⏸"; // Pause icon
      if (options.storeAsCurrentVideo) {
        this.isPlaying = true;
      }
    });

    video.addEventListener('pause', () => {
      playButton.innerHTML = "▶"; // Play icon
      if (options.storeAsCurrentVideo) {
        this.isPlaying = false;
      }
    });

    video.addEventListener('ended', () => {
      if (options.storeAsCurrentVideo) {
        this.isPlaying = false;
      }
      if (options.playNextOnEnd) {
        console.log('Video ended, playing next animation');
        this.playNextAnimationInSequence();
      }
    });

    // Auto-play and move to video if requested
    if (options.autoPlay) {
      video.addEventListener('loadeddata', () => {
        video.play().catch(error => {
          console.warn('Auto-play failed:', error);
        });
        
        if (options.moveToOnLoad) {
          // Move and zoom to this video when it starts playing
          const bounds = new OpenSeadragon.Rect(
            x - (width / 2) - 0.1,
            y - (height / 2) - 0.1,
            width + 0.2,
            height + 0.2
          );
          this.viewer.viewport.fitBounds(bounds, !options.playNextOnEnd); // Use immediate for sequence
        }
      });
    } else {
      video.addEventListener('loadeddata', () => {
        console.log('Video loaded and ready to play');
      });
    }

    // Add overlay to viewer
    this.viewer.addOverlay({
      element: container,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });

    // Track this video overlay for reliable removal
    this.videoOverlays.push(container);

    return container;
  }

  private moveToLocation(x: number, y: number, width: number, height: number, immediate: boolean = false, duration: number = 2) {
    const padding = 0.05; // Add some padding around the target area
    const bounds = new OpenSeadragon.Rect(
      x - (width / 2) - padding,
      y - (height / 2) - padding,
      width + (padding * 2),
      height + (padding * 2)
    );
    
    // Use custom animation timing for smoother transitions
    const currentAnimationTime = this.viewer.animationTime;
    this.viewer.animationTime = duration;
    
    this.viewer.viewport.fitBounds(bounds, false);
    
    // Restore original animation time after transition
    setTimeout(() => {
      this.viewer.animationTime = currentAnimationTime;
    }, duration * 1000);
  }

  private showNextNavigationCue(cue: any) {
    // Create a temporary highlight overlay
    const highlight = document.createElement("div");
    highlight.style.border = "2px dashed rgba(255, 255, 255, 0.8)";
    highlight.style.borderRadius = "8px";
    highlight.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    highlight.style.pointerEvents = "none";
    
    // Add overlay to show next target area
    this.viewer.addOverlay({
      element: highlight,
      location: new OpenSeadragon.Point(cue.x, cue.y),
      placement: 'CENTER',
      checkResize: false,
      width: cue.width,
      height: cue.height
    });
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      this.viewer.removeOverlay(highlight);
    }, 2000);
  }

  closeAnnotationPanel() {
    this.panelText = "";
    this.annotationImages = [];
    this.panelTitle = 'Annotation Details';
    this.currentAnnotationIndex = 0;
    this.panelTextIndex = 0;
    this.numPanels = 0;
  }
}
