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
          animationTime: 1.2,         
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

    // Handle canvas clicks
    this.viewer.addHandler('canvas-click', (event: any) => {
      var size = 0.2;
      if (event.quick) {
        var point = event.position;
        console.log("point", point);
        var vp = this.viewer.viewport.viewerElementToViewportCoordinates(point);
        console.log("Vp", vp);
        var box = new OpenSeadragon.Rect(vp.x - size / 2, vp.y - size / 2, size, size);
        console.log(box);
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
    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = false; // Always start with controls hidden
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.cursor = "pointer";

    // Show/hide controls on hover
    video.addEventListener('mouseenter', () => {
      if (!hideControls) {
        video.controls = true;
      }
    });

    video.addEventListener('mouseleave', () => {
      video.controls = false;
    });

    // Always prevent the click from bubbling to OpenSeadragon
    video.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Handle play/pause for all videos
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Auto-play the video when it's loaded
    video.addEventListener('loadeddata', () => {
      video.play().catch(error => {
        console.warn('Auto-play failed:', error);
      });
      
      // Move and zoom to this video when it starts playing
      const bounds = new OpenSeadragon.Rect(
        x - (width / 2) - 0.1,
        y - (height / 2) - 0.1,
        width + 0.2,
        height + 0.2
      );
      this.viewer.viewport.fitBounds(bounds, true);
    });

    // When video ends, play the next animation
    video.addEventListener('ended', () => {
      console.log('Video ended, playing next animation');
      this.playNextAnimationInSequence();
    });

    this.viewer.addOverlay({
      element: video,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });

    // Track this video overlay for reliable removal
    this.videoOverlays.push(video);
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
    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = false;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.cursor = "pointer";

    // Show/hide controls on hover
    video.addEventListener('mouseenter', () => {
      if (!hideControls) {
        video.controls = true;
      }
    });

    video.addEventListener('mouseleave', () => {
      video.controls = false;
    });

    // Handle click to play/pause
    video.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    // Don't auto-play when displaying all animations
    video.addEventListener('loadeddata', () => {
      console.log('Video loaded for display');
    });

    this.viewer.addOverlay({
      element: video,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });

    // Track this video overlay for reliable removal
    this.videoOverlays.push(video);
  }

  addVideoOverlayForPlayback(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = false;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.cursor = "pointer";

    // Store reference to current video
    this.currentVideo = video;

    // Track video progress
    video.addEventListener('loadedmetadata', () => {
      this.videoDuration = video.duration;
    });

    video.addEventListener('timeupdate', () => {
      this.videoProgress = (video.currentTime / video.duration) * 100;
    });


    // Handle click to play/pause
    video.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (video.paused) {
        video.play();
        this.isPlaying = true;
      } else {
        video.pause();
        this.isPlaying = false;
      }
    });

    // Track play state
    video.addEventListener('play', () => {
      this.isPlaying = true;
    });

    video.addEventListener('pause', () => {
      this.isPlaying = false;
    });

    video.addEventListener('ended', () => {
      this.isPlaying = false;
      this.playNextAnimationInSequence();
    });

        // Show/hide controls on hover
    video.addEventListener('mouseenter', () => {
      if (!hideControls) {
        video.controls = true;
      }
    });

    video.addEventListener('mouseleave', () => {
      video.controls = false;
    });

    // Don't auto-play when showing animation
    video.addEventListener('loadeddata', () => {
      console.log('Video loaded and ready to play');
    });

    this.viewer.addOverlay({
      element: video,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });

    // Track this video overlay for reliable removal
    this.videoOverlays.push(video);
  }

  addVideoOverlayWithSequence(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = false; // Always start with controls hidden
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.cursor = "pointer";

    // Store reference to current video - THIS WAS MISSING
    this.currentVideo = video;

    // Show/hide controls on hover
    video.addEventListener('mouseenter', () => {
      if (!hideControls) {
        video.controls = true;
      }
    });

    video.addEventListener('mouseleave', () => {
      video.controls = false;
    });

    // Always prevent the click from bubbling to OpenSeadragon
    video.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Handle play/pause for all videos
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    video.addEventListener('play', () => {
      this.isPlaying = true;
    });

    video.addEventListener('pause', () => {
      this.isPlaying = false;
    });

    // Auto-play the video when it's loaded
    video.addEventListener('loadeddata', () => {
      video.play().catch(error => {
        console.warn('Auto-play failed:', error);
      });

      // Move and zoom to this video when it starts playing with smooth transition
      const bounds = new OpenSeadragon.Rect(
        x - (width / 2) - 0.1,
        y - (height / 2) - 0.1,
        width + 0.2,
        height + 0.2
      );
      
      this.viewer.viewport.fitBounds(bounds, false);
    });

    // When video ends, play the next animation
    video.addEventListener('ended', () => {
      console.log('Video ended, playing next animation');
      this.playNextAnimationInSequence();
    });

    this.viewer.addOverlay({
      element: video,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });

    // Track this video overlay for reliable removal
    this.videoOverlays.push(video);
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
}