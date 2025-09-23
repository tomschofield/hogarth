import { Component, OnInit, AfterViewInit, OnDestroy, NgZone, ElementRef, ViewChild, HostListener } from '@angular/core';
import { ManifestService } from '../manifest.service';
import { AnnotationsService } from '../annotations.service';
import { AnimationsService } from '../animations.service';
import { ChatService, ChatMessage } from '../chat.service';
import { CanvasDatum } from '../canvas-datum';
import { Animation } from '../models/animation.interface';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
declare var OpenSeadragon: any;

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  viewer: any;
  panelText: string = "";
  canvasData: CanvasDatum[] = [];
  annotations: any[] = [];
  animations: Animation[] = [];
  allAnimations: Animation[] = [];
  pageIndex: number = 0;
  panelTextIndex: number = 0;
  panelTitle: string = 'Annotation Details';
  showingVideoTour: boolean = false;
  currentAnnotationIndex: number = 0;
  numPanels: number = 0;
  showingAnimations: boolean = false;
  showingAnnotations: boolean = false;
  animationIndex: number = 0;
  numAnimations: number = 0;
  private videoOverlays: any[] = [];
  private annotationOverlays: any[] = [];
  private infoMarkerOverlays: any[] = [];
  private currentVideo: HTMLVideoElement | null = null;
  private videoVisibilityState: Map<HTMLVideoElement, boolean> = new Map();
  private currentlyPlayingVideo: HTMLVideoElement | null = null;
  isPlaying: boolean = false;
  annotationImages: string[] = [];
  videoProgress: number = 0;
  videoDuration: number = 0;
  dragPosition = { x: 0, y: 0 };
  isMenuOpen: boolean = false;
  isAboutModalOpen: boolean = false;
  isIntroModalOpen: boolean = false;
  private hasShownInitialIntro: boolean = false;
  private shownIntroForPaintings: Set<number> = new Set();
  showingChat: boolean = false;
  showIntroductionPanel: boolean = false;
  subtitlesEnabled: boolean = true; // Subtitles enabled by default
  isMuted: boolean = false; // Audio mute state
  
  // Enhanced chat properties
  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  isLoadingChatResponse: boolean = false;
  availableCharacters: string[] = ['Hogarth', 'Sir Commodity Taxem', 'Election Agent', 'Serving Boy', 'Fiddling Nan'];
  selectedCharacter: string = 'Hogarth';
  
  // Konami code for unlocking chat feature
  private konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  private konamiIndex = 0;
  chatUnlocked = false;
  
  isSelecting: boolean = false;
  selectionStart: { x: number, y: number } | null = null;
  selectionEnd: { x: number, y: number } | null = null;
  selectionOverlay: HTMLElement | null = null;
  private selectedAnnotationElement: HTMLElement | null = null;
  private originalBounds: any = null;
  private isViewportAdjusted: boolean = false;

  @ViewChild('globalSubtitleContainer', { static: true }) globalSubtitleContainer!: ElementRef<HTMLDivElement>;

  constructor(
    private ngZone: NgZone,
    private manifestService: ManifestService,
    private annotationsService: AnnotationsService,
    private animationsService: AnimationsService,
    private chatService: ChatService
  ) { }

  ngOnInit() {
    // Keep this empty or only put non-DOM related initialization here
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    if (event.code === this.konamiCode[this.konamiIndex]) {
      this.konamiIndex++;
      if (this.konamiIndex === this.konamiCode.length) {
        this.chatUnlocked = !this.chatUnlocked;
        this.konamiIndex = 0;
        
        if (this.chatUnlocked) {
          console.log('🎮 Chat feature unlocked! The characters await your questions...');
          setTimeout(() => {
            console.log('💬 Chat buttons are now visible in the menu and controls!');
          }, 500);
        } else {
          console.log('🔒 Chat feature locked! Buttons are now hidden from view.');
          // Also close chat if it's currently open
          if (this.showingChat) {
            this.toggleChat(false);
          }
        }
      }
    } else {
      this.konamiIndex = 0;
    }
  }

  ngOnDestroy() {
    // Clean up event listeners
    document.removeEventListener('toggleAnimations', this.handleAnimationsToggle);
    document.removeEventListener('toggleAnnotations', this.handleAnnotationsToggle);
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

    // Check if OpenSeadragon is loaded
    if (typeof OpenSeadragon === 'undefined') {
      console.error('OpenSeadragon not loaded');
      return;
    }

    // Disable any existing video subtitle tracks
    this.disableAllVideoTracks();

    this.manifestService.getData().subscribe({
      next: (res) => {
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
            tileSources: tileSources,
            // Initial zoom and positioning to prevent top menu from covering painting
            defaultZoomLevel: 0.6,
            minZoomLevel: 0.5,
            maxZoomLevel: 3.0,
            visibilityRatio: 0.8,
            constrainDuringPan: false,
            centerVertically: false,
            homeFillsViewer: false 
          });

          // Only proceed if viewer was successfully created
          if (!this.viewer) {
            console.error('Failed to create OpenSeadragon viewer');
            return;
          }

          // Add event handlers only after successful viewer creation
          this.viewer.addHandler('open', () => {
            const canvas = this.viewer.canvas;
            if (canvas) {
              canvas.style.backgroundColor = 'black';

              // Add selection event listeners when chat is active
              //this.setupSelectionHandlers();
            }
          });
          this.viewer.addHandler('scrollHandler', (event: any) => {
            console.log(event)
          });
          // Handle page changes
          this.viewer.addHandler('page', (event: any) => {
            this.pageIndex = event.page;
            console.log("now on page ", this.pageIndex);

            // Show intro modal for each new painting only if not shown before
            if (!this.shownIntroForPaintings.has(this.pageIndex)) {
              this.openIntroModal();
              this.shownIntroForPaintings.add(this.pageIndex);
            }

            // Reset current annotation index to show default content
            this.currentAnnotationIndex = -1;
            
            // Reset introduction panel display state when changing pages
            this.showIntroductionPanel = false;

            // Set default annotation panel content for each painting
            this.setDefaultAnnotationContent();

            // Only add annotations if they are currently being shown
            if (this.showingAnnotations) {
              this.addAnnotations(this.annotations);
            }

            // Update animations for new page if showing animations
            if (this.showingAnimations) {
              this.removeAnimations();
              this.animations = this.allAnimations.filter(anim => anim.canvasIndex === this.pageIndex);
              this.numAnimations = this.animations.length;
              this.animationIndex = 0;
              this.showAllAnimations();
            }
          });

          this.viewer.addHandler('canvas-click',  (event) => {
            var viewportPoint = this.viewer.viewport.pointFromPixel(event.position);
          //  var imagePoint = this.viewer.viewport.viewportToImageCoordinates(viewportPoint.x, viewportPoint.y);
            console.log(viewportPoint);
          });

          this.viewer.addHandler('open', function () {
            console.log("Viewer opened successfully");
          });

          console.log('OpenSeadragon viewer initialized successfully');

          // Load annotations and animations after viewer is created
          this.loadAnnotationsAndAnimations();

        } catch (error) {
          console.error('Error initializing OpenSeadragon viewer:', error);
          this.viewer = null; // Ensure viewer is null on error
        }
      },
      error: (error) => {
        console.error("Error loading manifest data:", error);
      }
    });
  }

  private loadAnnotationsAndAnimations() {
    let annotationsLoaded = false;
    let animationsLoaded = false;
    
    const checkAndAutoToggle = () => {
      if (annotationsLoaded && animationsLoaded) {
        // Show intro modal for the first painting when everything is loaded (only on initial load)
        if (!this.hasShownInitialIntro) {
          setTimeout(() => {
            if (!this.shownIntroForPaintings.has(this.pageIndex)) {
              this.openIntroModal();
              this.shownIntroForPaintings.add(this.pageIndex);
            }
            this.hasShownInitialIntro = true;
          }, 500);
        }
        
        // Both data sets are loaded, now we can safely auto-toggle
        setTimeout(() => {
          // Toggle animations on after 1 second
          this.toggleAnimations(true);
          
          setTimeout(() => {
            // Toggle annotations on after 2 more seconds
            this.toggleAnnotations(true);
          }, 2000);
        }, 1000);
      }
    };
    
    // Fetch annotation data
    this.annotationsService.getData().subscribe({
      next: (res) => {
        this.annotations = res;
        // Set default annotation content after annotations are loaded
        this.setDefaultAnnotationContent();
        annotationsLoaded = true;
        checkAndAutoToggle();
      },
      error: (error) => {
        console.error("Error loading annotations data:", error);
      }
    });

    // Fetch animation data
    this.animationsService.getData().subscribe({
      next: (res) => {
        this.allAnimations = res;  // Store all animations here
        this.animations = res;     // Keep this for backward compatibility
        this.numAnimations = this.animations.length;
        animationsLoaded = true;
        checkAndAutoToggle();
      },
      error: (error) => {
        console.error("Error loading animations data:", error);
      }
    });
  }

  move(x: number, y: number, width: number, height: number) {
    if (!this.viewer) {
      console.warn('Viewer not initialized');
      return;
    }
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
        ///updated from "annotation type so that we can highlight the introductions"
        this.addAnnotation(element.x, element.y, index, element["annotation title"]);
      }
      index++;
    });

    // Add info marker to the current painting
    this.addInfoMarker();
  }

  addAnnotation(x: number, y: number, index: number, type: string) {
    if (!this.viewer) {
      console.warn('Viewer not initialized, cannot add annotation');
      return;
    }

    // Don't show markers for Introduction annotations
    if (type === "Introduction") {
      return;
    }
    
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
    elt.style.width = "20px";
    elt.style.height = "20px";
    elt.style.position = "relative";
    elt.style.transition = "all 0.1s ease";
    elt.style.display = "block";
    elt.style.visibility = "visible";

    elt.style.backgroundSize = "contain";
    elt.style.backgroundRepeat = "no-repeat";
    elt.style.backgroundPosition = "center";

    // Add color class based on type for potential future styling
    // if (type === "Introduction" || type === "The political context") {
    //   elt.classList.add("pushpin-yellow");
    //   elt.style.backgroundImage = "url('assets/icons/push_pin_yellow.svg')";
    // } else {
    //   elt.classList.add("pushpin-blue");
    //   elt.style.backgroundImage = "url('assets/icons/push_pin.svg')";
    // }
    elt.style.backgroundImage = "url('assets/icons/push_pin.svg')";

    // Create tooltip element
    var tooltip = document.createElement("div");
    tooltip.innerHTML = this.annotations[index]["annotation title"] || "Annotation";
    tooltip.style.position = "absolute";
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
    arrow.style.width = "0";
    arrow.style.height = "0";
    arrow.style.borderLeft = "5px solid transparent";
    arrow.style.borderRight = "5px solid transparent";

    // Function to position tooltip dynamically
    // Function to position tooltip dynamically
    const positionTooltip = () => {
      if (!tooltip.offsetParent) return;
      
      const rect = elt.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      // Get the OpenSeadragon viewer container bounds instead of viewport
      const viewerContainer = document.getElementById('seadragon-viewer');
      if (!viewerContainer) return;
      
      const containerRect = viewerContainer.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      const containerLeft = containerRect.left;
      const containerTop = containerRect.top;
      const containerRight = containerRect.right;
      const containerBottom = containerRect.bottom;
      
      // Reset positioning
      tooltip.style.top = "";
      tooltip.style.bottom = "";
      tooltip.style.left = "";
      tooltip.style.right = "";
      tooltip.style.transform = "";
      arrow.style.top = "";
      arrow.style.bottom = "";
      arrow.style.left = "";
      arrow.style.right = "";
      arrow.style.marginLeft = "";
      arrow.style.marginTop = "";
      arrow.style.borderTop = "";
      arrow.style.borderBottom = "";
      arrow.style.borderLeft = "5px solid transparent";
      arrow.style.borderRight = "5px solid transparent";
      
      // Calculate tooltip position relative to marker and container bounds
      const tooltipLeft = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      const tooltipRight = tooltipLeft + tooltipRect.width;
      const tooltipTop = rect.top - tooltipRect.height - 10;
      const tooltipBottom = rect.bottom + tooltipRect.height + 10;
      
      // Check if tooltip fits above and within container bounds
      if (tooltipTop >= containerTop && tooltipLeft >= containerLeft && tooltipRight <= containerRight) {
        // Position above (default)
        tooltip.style.bottom = "100%";
        tooltip.style.left = "50%";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.marginBottom = "8px";
        arrow.style.top = "100%";
        arrow.style.left = "50%";
        arrow.style.marginLeft = "-5px";
        arrow.style.borderTop = "5px solid rgba(0, 0, 0, 0.9)";
      }
      // Check if tooltip fits below and within container bounds
      else if (tooltipBottom <= containerBottom && tooltipLeft >= containerLeft && tooltipRight <= containerRight) {
        // Position below
        tooltip.style.top = "100%";
        tooltip.style.left = "50%";
        tooltip.style.transform = "translateX(-50%)";
        tooltip.style.marginTop = "8px";
        arrow.style.bottom = "100%";
        arrow.style.left = "50%";
        arrow.style.marginLeft = "-5px";
        arrow.style.borderBottom = "5px solid rgba(0, 0, 0, 0.9)";
      }
      // Check if tooltip fits to the right and within container bounds
      else if (rect.right + tooltipRect.width + 10 <= containerRight) {
        // Position to the right
        tooltip.style.left = "100%";
        tooltip.style.top = "50%";
        tooltip.style.transform = "translateY(-50%)";
        tooltip.style.marginLeft = "8px";
        arrow.style.right = "100%";
        arrow.style.top = "50%";
        arrow.style.marginTop = "-5px";
        arrow.style.borderLeft = "5px solid transparent";
        arrow.style.borderRight = "5px solid rgba(0, 0, 0, 0.9)";
        arrow.style.borderTop = "5px solid transparent";
        arrow.style.borderBottom = "5px solid transparent";
      }
      // Position to the left
      else {
        tooltip.style.right = "100%";
        tooltip.style.top = "50%";
        tooltip.style.transform = "translateY(-50%)";
        tooltip.style.marginRight = "8px";
        arrow.style.left = "100%";
        arrow.style.top = "50%";
        arrow.style.marginTop = "-5px";
        arrow.style.borderLeft = "5px solid rgba(0, 0, 0, 0.9)";
        arrow.style.borderRight = "5px solid transparent";
        arrow.style.borderTop = "5px solid transparent";
        arrow.style.borderBottom = "5px solid transparent";
      }
    };

    tooltip.appendChild(arrow);
    elt.appendChild(tooltip);

    this.viewer.addOverlay({
      element: elt,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: 0.02,
      height: 0.02,
      index: index
    });

    // Apply z-index to the OpenSeadragon wrapper element after overlay is added
    setTimeout(() => {
      const wrapperElement = document.querySelector(`[id*="overlay-wrapper-annotation_${index}"]`) as HTMLElement;
      if (wrapperElement) {
        wrapperElement.style.zIndex = "9999";
      }
    }, 50);

    // Track this annotation overlay for reliable removal
    this.annotationOverlays.push(elt);

    // Add hover effects using JavaScript since CSS might not penetrate OpenSeadragon
     elt.addEventListener('mouseenter', () => {
      // Only apply hover effects if not selected
      if (this.selectedAnnotationElement !== elt) {
        
        // Update wrapper z-index on hover
        const wrapperElement = document.querySelector(`[id*="overlay-wrapper-annotation_${index}"]`) as HTMLElement;
        if (wrapperElement) {
          wrapperElement.style.zIndex = "10004";
        }
        
        tooltip.style.opacity = "1";

        setTimeout(() => positionTooltip(), 10);

        if (type === "multi-level") {
          elt.classList.add("pulse-multi-hover");
        } else {
          elt.classList.add("pulse-hover");
        }
      } else {
        // Show tooltip for selected annotation
        tooltip.style.opacity = "1";
        setTimeout(() => positionTooltip(), 10);
      }
    });

    elt.addEventListener('mouseleave', () => {
      // Only reset hover styles if not selected
      if (this.selectedAnnotationElement !== elt) {
        
        // Reset wrapper z-index
        const wrapperElement = document.querySelector(`[id*="overlay-wrapper-annotation_${index}"]`) as HTMLElement;
        if (wrapperElement) {
          wrapperElement.style.zIndex = "9999";
        }
        
        elt.classList.remove("pulse-hover", "pulse-multi-hover");
        tooltip.style.opacity = "0";
      } else {
        // Hide tooltip for selected annotation when not hovering
        tooltip.style.opacity = "0";
      }
    });

    new OpenSeadragon.MouseTracker({
      element: elt,
      clickHandler: e => this.setAnnotation(index),
    });
  }

  addInfoMarker() {
    if (!this.viewer) {
      console.warn('Viewer not initialized, cannot add info marker');
      return;
    }

    // Calculate top left-center position for info marker
    // For the top left-center of the painting, we'll use x=0.3 (left of center) and y=0.1 (near top)
    const x = 0.4;
    const y = 0.1;
    
    var elt = document.createElement("div");
    elt.className = "info-marker";
    elt.id = "info-marker";
    elt.style.cursor = "pointer";
    elt.innerHTML = "Introductory note";

    elt.style.borderRadius = "5px";
    elt.style.position = "relative";
    elt.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    elt.style.color = "white";
    elt.style.display = "flex";
    elt.style.alignItems = "center";
    elt.style.justifyContent = "center";
    elt.style.padding = "6px 10px";
    
    // Add click handler to show introduction
    new OpenSeadragon.MouseTracker({
      element: elt,
      clickHandler: e => {
        e.preventDefaultAction = true;
        this.showIntroduction();
        return false;
      },
    });

    this.viewer.addOverlay({
      element: elt,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false
    });

    // Apply z-index to ensure it's visible but below annotation markers
    setTimeout(() => {
      const wrapperElement = elt.parentElement;
      if (wrapperElement) {
        wrapperElement.style.zIndex = "8000"; // Below annotation markers (9999) but above videos
      }
    }, 50);

    // Track this info marker overlay for removal
    this.infoMarkerOverlays.push(elt);
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
    if (!this.viewer) return;

    // Reset selected annotation reference
    this.selectedAnnotationElement = null;

    // Remove all tracked annotation overlays
    this.annotationOverlays.forEach(annotationElement => {
      this.viewer.removeOverlay(annotationElement);
    });
    // Clear the tracking array
    this.annotationOverlays = [];

    // Remove all tracked info marker overlays
    this.infoMarkerOverlays.forEach(infoMarkerElement => {
      this.viewer.removeOverlay(infoMarkerElement);
    });
    // Clear the info marker tracking array
    this.infoMarkerOverlays = [];
  }

  removeAnimations() {
    if (!this.viewer) return;

    // Clear current video reference
    this.currentVideo = null;
    this.currentlyPlayingVideo = null;

    // Clear global subtitles
    this.clearGlobalSubtitles();

    // Remove all tracked video overlays and their play buttons
    this.videoOverlays.forEach(video => {
      // Clean up visibility state
      this.videoVisibilityState.delete(video);
      
      // Remove associated play button if it exists
      if (video._playButton && video._playButton.parentElement) {
        video._playButton.parentElement.removeChild(video._playButton);
      }
      this.viewer.removeOverlay(video);
    });
    // Clear the tracking array
    this.videoOverlays = [];
  }

  // Method to pause and hide all videos except the specified one (for play button interactions)
  private pauseAndHideAllVideosExcept(excludeVideo: HTMLVideoElement | null = null) {
    // If no video is being excluded (all videos paused), clear subtitles
    if (!excludeVideo) {
      this.clearGlobalSubtitles();
    }
    
    this.videoOverlays.forEach(overlay => {
      const video = overlay.querySelector('video') as HTMLVideoElement;
      if (video && video !== excludeVideo) {
        if (!video.paused) {
          video.pause();
          console.log('Paused and hiding video due to another video starting');
        }
        // Hide the video if it's not the one being played
        video.style.display = "none";
        this.videoVisibilityState.set(video, false);
      }
    });
    
    // Update currently playing video reference
    this.currentlyPlayingVideo = excludeVideo;
  }

  setAnnotation(index: number) {
    // Reset previously selected annotation
    if (this.selectedAnnotationElement) {
      this.resetAnnotationStyle(this.selectedAnnotationElement);
    }

    // Find and style the new selected annotation
    const selectedElement = document.getElementById("annotation_" + index);
    if (selectedElement) {
      this.selectedAnnotationElement = selectedElement;
      this.setSelectedAnnotationStyle(selectedElement);
    }

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

    // Adjust viewport when annotation is selected
    this.adjustViewportForPanel(true);
  }

  private setSelectedAnnotationStyle(element: HTMLElement) {
    // Apply selected style using orange pin SVG
    element.style.backgroundImage = "url('assets/icons/push_pin_orange.svg')";

    // Update wrapper z-index for selected annotation
    const index = element.id.replace('annotation_', '');
    const wrapperElement = document.querySelector(`[id*="overlay-wrapper-annotation_${index}"]`) as HTMLElement;
    if (wrapperElement) {
      wrapperElement.style.zIndex = "10003";
    }
  }

  private resetAnnotationStyle(element: HTMLElement) {
    // Determine original type from classes
    // const isYellow = element.classList.contains("pushpin-yellow");
    
    // // Reset to original SVG style
    // if (isYellow) {
    //   element.style.backgroundImage = "url('assets/icons/push_pin_yellow.svg')";
    // } else {
    //   element.style.backgroundImage = "url('assets/icons/push_pin.svg')";
    // }
    element.style.backgroundImage = "url('assets/icons/push_pin.svg')";

    // Ensure all background properties are set correctly


    // Reset wrapper z-index
    const index = element.id.replace('annotation_', '');
    const wrapperElement = document.querySelector(`[id*="overlay-wrapper-annotation_${index}"]`) as HTMLElement;
    if (wrapperElement) {
      wrapperElement.style.zIndex = "9999";
    }
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
      this.showingChat = false;
      this.addAnnotations(this.annotations);
    } else {
      this.removeAnnotations();
      this.adjustViewportForPanel(false);
    }
  }

  toggleAnimations(show: boolean) {
    this.showingAnimations = show;
    if (show) {
      // Filter animations for current page and sort by storyIndex
      this.animations = this.allAnimations
        .filter(anim => anim.canvasIndex === this.pageIndex)
        .sort((a, b) => a.storyIndex - b.storyIndex);

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

  private loadImagesFromFilename(imageFilename: string) {
    this.annotationImages = [];
    if (imageFilename && imageFilename.trim() !== '') {
      const filenames = imageFilename.trim().split(' ');
      filenames.forEach(filename => {
        if (filename.trim() !== '') {
          this.annotationImages.push(`assets/panelImages/${filename.trim()}`);
        }
      });
    }
  }

  updateImagesForCurrentPanel() {
    // Get images for the current panel
    const imageFilename = this.annotations[this.currentAnnotationIndex][`image filename ${this.panelTextIndex}`];
    this.loadImagesFromFilename(imageFilename);
  }

  previousPanel() {
    if (this.panelTextIndex > 0) {
      this.panelTextIndex--;
      
      if (this.currentAnnotationIndex === -1) {
        // For introduction content, find the intro annotation
        const paintingTitles = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];
        const currentPaintingTitle = paintingTitles[this.pageIndex];
        const introAnnotation = this.annotations.find(annotation => 
          annotation["painting title"] === currentPaintingTitle && 
          annotation["annotation title"] === "Introduction"
        );
        
        if (introAnnotation) {
          this.panelText = this.formatPanelText(
            introAnnotation[`annotation text ${this.panelTextIndex}`]
          );
          // Update images for introduction
          const imageFilename = introAnnotation[`image filename ${this.panelTextIndex}`];
          this.loadImagesFromFilename(imageFilename);
        }
      } else {
        // For regular annotations
        this.panelText = this.formatPanelText(
          this.annotations[this.currentAnnotationIndex][`annotation text ${this.panelTextIndex}`]
        );
        // Update images for the new panel
        this.updateImagesForCurrentPanel();
      }
    }
  }

  nextPanel() {
    if (this.panelTextIndex < this.numPanels - 1) {
      this.panelTextIndex++;

      if (this.currentAnnotationIndex === -1) {
        // For introduction content, find the intro annotation
        const paintingTitles = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];
        const currentPaintingTitle = paintingTitles[this.pageIndex];
        const introAnnotation = this.annotations.find(annotation => 
          annotation["painting title"] === currentPaintingTitle && 
          annotation["annotation title"] === "Introduction"
        );
        
        if (introAnnotation) {
          this.panelText = this.formatPanelText(
            introAnnotation[`annotation text ${this.panelTextIndex}`]
          );
          // Update images for introduction
          const imageFilename = introAnnotation[`image filename ${this.panelTextIndex}`];
          this.loadImagesFromFilename(imageFilename);
        }
      } else {
        // For regular annotations
        this.panelText = this.formatPanelText(
          this.annotations[this.currentAnnotationIndex][`annotation text ${this.panelTextIndex}`]
        );
        // Update images for the new panel
        this.updateImagesForCurrentPanel();
      }
    }
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
    if (!this.viewer || this.animations.length === 0 || index >= this.animations.length) {
      console.warn('Cannot move to animation: viewer not initialized or invalid index');
      return;
    }

    const animation = this.animations[index];

    // Check if the animation has custom viewport properties
    if (animation.viewportX !== undefined && animation.viewportY !== undefined && animation.viewportZoom !== undefined) {
      // Use custom viewport positioning
      this.moveToViewportPosition(animation.viewportX, animation.viewportY, animation.viewportZoom);
    } else {
      // Fall back to the original bounds-based positioning
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

  private moveToViewportPosition(x: number, y: number, zoom: number) {
    if (!this.viewer) {
      console.warn('Viewer not initialized');
      return;
    }

    // Convert the normalized coordinates (0-1) to OpenSeadragon viewport coordinates
    const viewportPoint = new OpenSeadragon.Point(x, y);
    
    // Set the zoom level and center the viewport on the specified point
    this.viewer.viewport.panTo(viewportPoint, false);
    this.viewer.viewport.zoomTo(zoom, viewportPoint, false);
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
    // Find the animation data to get timing information
    const animation = this.animations.find(anim =>
      anim.x === x && anim.y === y && anim.videoUrl === videoUrl
    );

    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: false,
      storeAsCurrentVideo: false,
      startTime: animation?.startTime,
      stopTime: animation?.stopTime,
      showInitially: false, // Keep videos hidden until play button is clicked
      subtitles: animation?.subtitles,
      showSubtitles: animation?.showSubtitles,
      subtitleLanguage: animation?.subtitleLanguage
    });
  }

  addVideoOverlayForPlayback(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    // Find the animation data to get navigation cues and timing
    // Use the current animation directly instead of searching by coordinates
    const animation = this.animations[this.animationIndex];

    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: false,
      storeAsCurrentVideo: true,
      trackProgress: true,
      playNextOnEnd: true,
      navigationCues: animation?.navigationCues,
      startTime: animation?.startTime,
      stopTime: animation?.stopTime,
      showInitially: true, // Show video immediately for playback mode
      subtitles: animation?.subtitles,
      showSubtitles: animation?.showSubtitles,
      subtitleLanguage: animation?.subtitleLanguage
    });
  }

  addVideoOverlayWithSequence(x: number, y: number, videoUrl: string, width: number, height: number, hideControls?: boolean) {
    // Find the animation data to get navigation cues and timing
    const animation = this.animations[this.animationIndex];

    return this.createVideoOverlay(x, y, videoUrl, width, height, {
      autoPlay: true,
      moveToOnLoad: true,
      playNextOnEnd: true,
      storeAsCurrentVideo: true,
      navigationCues: animation?.navigationCues,
      startTime: animation?.startTime,
      stopTime: animation?.stopTime,
      showInitially: true, // Show video immediately for sequence mode
      subtitles: animation?.subtitles,
      showSubtitles: animation?.showSubtitles,
      subtitleLanguage: animation?.subtitleLanguage
    });
  }

  playNextAnimationInSequence() {
    // Move to next animation
    if (this.animationIndex < this.numAnimations - 1) {
      this.animationIndex++;

      // Get the next animation
      const nextAnimation = this.animations[this.animationIndex];
      const currentAnimation = this.animations[this.animationIndex - 1];
      console.log('Playing next animation:', nextAnimation);

      // Check if it's the same video file
      if (currentAnimation && nextAnimation.videoUrl === currentAnimation.videoUrl && this.currentVideo) {
        // Same video file - pause first, then seek to start time
        console.log('Same video file, seeking to start time:', nextAnimation.startTime);

        this.currentVideo.pause();

        // Wait for pause to complete, then set time and play
        setTimeout(() => {
          if (this.currentVideo) {
            if (nextAnimation.startTime !== undefined) {
              console.log('Setting currentTime to:', nextAnimation.startTime);
              this.currentVideo.currentTime = nextAnimation.startTime;
            } else {
              this.currentVideo.currentTime = 0;
            }

            // Wait for seek to complete before playing
            const seekHandler = () => {
              console.log('Seek completed, starting playback from:', this.currentVideo?.currentTime);
              if (this.currentVideo) {
                this.currentVideo.play().catch(error => {
                  console.warn('Auto-play failed:', error);
                });
                this.isPlaying = true;
                this.currentVideo.removeEventListener('seeked', seekHandler);
              }
            };

            this.currentVideo.addEventListener('seeked', seekHandler);

            // Fallback in case seeked doesn't fire
            setTimeout(() => {
              if (this.currentVideo && this.currentVideo.paused) {
                this.currentVideo.removeEventListener('seeked', seekHandler);
                this.currentVideo.play().catch(error => {
                  console.warn('Fallback auto-play failed:', error);
                });
                this.isPlaying = true;
              }
            }, 200);
          }
        }, 100);

        // Move to the animation location
        this.moveToAnimation(this.animationIndex);

      } else {
        // Different video file - remove current and create new overlay
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
            this.isPlaying = true;

            // Move to the animation with smooth transition
            this.moveToAnimation(this.animationIndex);
          }
        }, 100);
      }
    } else {
      console.log('All animations played, sequence complete');
      // Optionally reset to first animation or show all animations
      this.isPlaying = false;
      this.showAllAnimations();
    }
  }

  private setupVideoForSequence(video: HTMLVideoElement, animation: any) {
    // Set start time if specified
    if (animation.startTime !== undefined) {
      video.currentTime = animation.startTime;
    }

    // Set up stop time listener
    video.addEventListener('timeupdate', () => {
      if (animation.stopTime !== undefined && video.currentTime >= animation.stopTime) {
        if (!video.paused) {
          video.pause();
          this.isPlaying = false;

          setTimeout(() => {
            this.playNextAnimationInSequence();
          }, 50);
        }
      }
    });
  }

  goBack() {
    this.showingAnimations = false;
    this.showingAnnotations = true;
  }

  stopVideoTour() {
    this.removeAnimations();
  }

  onImageError(event: any) {
    console.warn('Failed to load annotation image:', event.target.src);
    // Optionally hide the image or show a placeholder
    event.target.style.display = 'none';
  }

  onProgressBarClick(event: MouseEvent) {
    if (!this.currentVideo) {
      return;
    }

    const video = this.currentVideo;
    
    // Only allow seeking if video has loaded and has a valid duration
    if (!video.duration || video.duration === Infinity || isNaN(video.duration)) {
      return;
    }

    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progressBarWidth = rect.width;
    
    // Calculate the percentage of the progress bar that was clicked
    const clickPercentage = Math.max(0, Math.min(1, clickX / progressBarWidth));
    
    // Convert to video time and seek
    const targetTime = clickPercentage * video.duration;
    this.seekToTime(targetTime);
  }

  // Method to clear global subtitles
  private clearGlobalSubtitles() {
    if (this.globalSubtitleContainer) {
      const globalContainer = this.globalSubtitleContainer.nativeElement;
      globalContainer.style.display = "none";
      globalContainer.innerHTML = "";
    }
  }

  // Method to disable all video subtitle tracks
  private disableAllVideoTracks() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
    });
  }

  // Method to load and parse WebVTT subtitle files
  private async loadWebVTTSubtitles(vttUrl: string): Promise<any[]> {
    try {
      const response = await fetch(vttUrl);
      const vttText = await response.text();
      return this.parseWebVTT(vttText);
    } catch (error) {
      console.error('Error loading WebVTT file:', error);
      return [];
    }
  }

  // Method to parse WebVTT text into subtitle objects
  private parseWebVTT(vttText: string): any[] {
    const subtitles: any[] = [];
    const lines = vttText.split('\n');
    let i = 0;

    // Skip header
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }

    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.includes('-->')) {
        const timeParts = line.split('-->');
        const startTime = this.parseVTTTime(timeParts[0].trim());
        const endTime = this.parseVTTTime(timeParts[1].trim());
        
        i++;
        let text = '';
        
        // Collect subtitle text until next timestamp or end
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
          if (text) text += ' ';
          text += lines[i].trim();
          i++;
        }
        
        if (text) {
          subtitles.push({
            start: startTime,
            end: endTime,
            text: text
          });
        }
      } else {
        i++;
      }
    }
    
    return subtitles;
  }

  // Helper method to parse VTT time format (HH:MM:SS.mmm)
  private parseVTTTime(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]) || 0;
    const milliseconds = parseInt(secondsParts[1]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  private seekToTime(targetTime: number) {
    if (!this.currentVideo) {
      return;
    }

    const video = this.currentVideo;
    
    // Ensure video is not loading and has valid duration
    if (!video.duration || video.duration === Infinity || isNaN(video.duration)) {
      return;
    }

    // Get current animation to check for time bounds
    const animation = this.animations[this.animationIndex];
    const startTime = animation?.startTime || 0;
    const stopTime = animation?.stopTime || video.duration;
    
    // Convert the target time to the bounded range
    const effectiveDuration = stopTime - startTime;
    const boundedTargetTime = startTime + (targetTime / video.duration) * effectiveDuration;
    
    // Clamp to valid range
    const clampedTime = Math.max(startTime, Math.min(boundedTargetTime, stopTime));
    
    // Store the current play state
    const wasPlaying = !video.paused;
    
    // Seek to the target time
    video.currentTime = clampedTime;
    
    // Maintain play state after seeking
    if (wasPlaying) {
      video.play().catch(console.error);
    }
  }

  private createVideoOverlay(x: number, y: number, videoUrl: string, width: number, height: number, options: {
    autoPlay?: boolean;
    hideControls?: boolean;
    storeAsCurrentVideo?: boolean;
    trackProgress?: boolean;
    moveToOnLoad?: boolean;
    playNextOnEnd?: boolean;
    navigationCues?: any[];
    startTime?: number;
    stopTime?: number;
    showInitially?: boolean;
    subtitles?: any[] | string;  // Inline subtitles or WebVTT file path
    showSubtitles?: boolean;
    subtitleLanguage?: string;
  } = {}) {
    if (!this.viewer) {
      console.warn('Viewer not initialized, cannot create video overlay');
      return null;
    }

    var video = document.createElement("video");
    video.src = videoUrl;
    video.controls = false;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.cursor = "pointer";
    
    // Apply current mute state to new video
    video.muted = this.isMuted;

    // Initially hide the video unless showInitially is true
    if (options.showInitially) {
      video.style.display = "block";
      this.videoVisibilityState.set(video, true);
    } else {
      video.style.display = "none";
      this.videoVisibilityState.set(video, false);
    }

    // Set start time if specified
    if (options.startTime !== undefined) {
      video.currentTime = options.startTime;
    }

    // Create play button overlay
    var playButton = document.createElement("div");
    playButton.innerHTML = "▶"; // Play icon
    playButton.style.position = "fixed";
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
    playButton.style.zIndex = "8500"; // Below annotation markers but above videos
    playButton.style.pointerEvents = "auto";
    playButton.style.paddingLeft = "2px";
  
    // Create container for video only
    var container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = "100%";
    container.style.height = "100%";
    container.appendChild(video);

    // Store subtitle information for global subtitle handling
    let videoSubtitles: any[] = [];
    if (options.subtitles && options.showSubtitles) {
      if (typeof options.subtitles === 'string') {
        // WebVTT file - load and parse manually instead of using native tracks
        this.loadWebVTTSubtitles(options.subtitles).then(subtitles => {
          videoSubtitles = subtitles;
          // Store reference on video element for access in event handlers
          (video as any)._subtitles = subtitles;
        }).catch(error => {
          console.warn('Failed to load WebVTT subtitles:', error);
        });
      } else if (Array.isArray(options.subtitles)) {
        // Inline subtitles array
        videoSubtitles = options.subtitles;
        (video as any)._subtitles = options.subtitles;
      }
    }

    // Disable any native video subtitles to prevent browser rendering
    video.addEventListener('loadedmetadata', () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
    });

    // Add play button to document body instead of container
    document.body.appendChild(playButton);

    // Store reference to component instance for use in event handlers
    const componentInstance = this;
  
    // Function to update play button position
    const updatePlayButtonPosition = () => {
      if (!container.parentElement) return;
      
      const containerRect = container.getBoundingClientRect();
      playButton.style.left = `${containerRect.left + containerRect.width / 2 - 30}px`;
      playButton.style.top = `${containerRect.top + containerRect.height / 2 - 30}px`;
    };
  
    // Function to bring this video to front
    const bringToFront = () => {
      // Reset all video overlays to lower z-index
      this.videoOverlays.forEach(overlay => {
        const wrapperElement = overlay.parentElement;
        if (wrapperElement && wrapperElement.style) {
          wrapperElement.style.zIndex = "5000"; // Below annotation markers (9999)
        }
      });
  
      // Bring current video to front (but still below annotation markers)
      setTimeout(() => {
        const wrapperElement = container.parentElement;
        if (wrapperElement && wrapperElement.style) {
          wrapperElement.style.zIndex = "8000"; // Higher than other videos but below annotation markers
        }
        // Update play button position after z-index changes
        updatePlayButtonPosition();
      }, 10);
    };
  
    // Update play button position on viewport changes
    if (this.viewer) {
      this.viewer.addHandler('animation', updatePlayButtonPosition);
      this.viewer.addHandler('resize', updatePlayButtonPosition);
    }
  
    // Initial position update
    setTimeout(updatePlayButtonPosition, 100);
  
    // Handle time updates - check for stop time and update subtitles
    video.addEventListener('timeupdate', () => {
      const currentTime = video.currentTime;

      // Handle inline subtitles using global container
      // Get subtitles from video element (set asynchronously for WebVTT)
      const videoSubtitles = (video as any)._subtitles || [];
      
      // Only show subtitles if this is the currently playing video
      if (videoSubtitles.length > 0 && this.globalSubtitleContainer) {
        const activeSubtitle = videoSubtitles.find((sub: any) => 
          currentTime >= sub.start && currentTime <= sub.end
        );

        if (activeSubtitle && this.subtitlesEnabled && 
            this.currentlyPlayingVideo === video && !video.paused) {
          const globalContainer = this.globalSubtitleContainer.nativeElement;
          globalContainer.innerHTML = activeSubtitle.text;
          globalContainer.style.display = "block";
          console.log('Showing subtitle:', activeSubtitle.text);
        } else if (this.currentlyPlayingVideo === video) {
          // Clear subtitles when no active subtitle for this time or video is paused
          this.clearGlobalSubtitles();
        }
      }

      // Check if we've reached the stop time
      if (options.stopTime !== undefined && currentTime >= options.stopTime) {
        // Only trigger if video is still playing (prevent multiple triggers)
        if (!video.paused) {
          video.pause();
          if (options.storeAsCurrentVideo) {
            this.isPlaying = false;
          }
  
          // If playNextOnEnd is true, trigger next animation
          if (options.playNextOnEnd) {
            console.log('Video reached stop time at:', currentTime, 'playing next animation');
            // Add a small delay to ensure the video state is properly updated
            setTimeout(() => {
              this.playNextAnimationInSequence();
            }, 50);
          }
        }
      }
    });

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

            // Use viewport positioning if available, otherwise fall back to bounds-based positioning
            if (nextCue.viewportX !== undefined && nextCue.viewportY !== undefined && nextCue.viewportZoom !== undefined) {
              this.moveToLocationWithViewport(nextCue.viewportX, nextCue.viewportY, nextCue.viewportZoom);
            } else {
              // Move the viewer to the specified location using bounds
              this.moveToLocation(nextCue.x, nextCue.y, nextCue.width, nextCue.height);
            }

            currentCueIndex++;
          }
        }
      });

      // Reset cue index when video starts over or is seeked
      video.addEventListener('seeked', () => {
        currentCueIndex = navigationCues.findIndex(cue => cue.time > video.currentTime);
        if (currentCueIndex === -1) currentCueIndex = navigationCues.length;
      });
    }
  
  // Show/hide play button on hover with timeout
  let hideTimeout: any;

  container.addEventListener('mouseenter', () => {
    // Clear any pending hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    
    if (video.paused) {
      playButton.innerHTML = "▶"; // Play icon
      playButton.style.opacity = "1";
    } else {
      playButton.innerHTML = "⏸"; // Pause icon
      playButton.style.opacity = "1";
    }
    updatePlayButtonPosition();
  });

  container.addEventListener('mouseleave', () => {
    // Delay hiding to allow moving to play button
    hideTimeout = setTimeout(() => {
      playButton.style.opacity = "0";
    }, 200);
  });

  // Keep play button visible when hovering over it
  playButton.addEventListener('mouseenter', () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });

  playButton.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
      playButton.style.opacity = "0";
    }, 200);
  });    // Handle play button click using OpenSeadragon MouseTracker
    new OpenSeadragon.MouseTracker({
      element: playButton,
      clickHandler: (event: any) => {
        console.log('Play button clicked via MouseTracker!');
        event.preventDefaultAction = true;

        // Show video on first play
        if (!this.videoVisibilityState.get(video)) {
          video.style.display = "block";
          this.videoVisibilityState.set(video, true);
          console.log('Video made visible for first time');
        }

        if (video.paused) {
          console.log('Playing video via MouseTracker');

          // Find the corresponding animation index and sync with animation controls
          if (!options.storeAsCurrentVideo && !options.trackProgress) {
            const animationIndex = this.findAnimationIndexByVideo(x, y, videoUrl);
            if (animationIndex !== -1) {
              this.syncWithAnimationControls(animationIndex, video);
            }
            this.pauseAndHideAllVideosExcept(video);
          }
  
          // Bring this video to front when playing
          bringToFront();
          
          // Only reset to beginning if no startTime is specified
          // If startTime exists, use it; otherwise start from current position or 0
          if (options.startTime !== undefined) {
            video.currentTime = options.startTime;
            console.log('Set video time to startTime:', options.startTime);
          } else if (video.currentTime === 0 || video.ended) {
            // Only reset to 0 if video is at the beginning or has ended
            video.currentTime = 0;
            console.log('Set video time to beginning: 0');
          }
          // Otherwise, continue from current position

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
        // Calculate effective duration (stopTime - startTime or full duration)
        const startTime = options.startTime || 0;
        const stopTime = options.stopTime || video.duration;
        this.videoDuration = stopTime - startTime;
      });

      video.addEventListener('timeupdate', () => {
        const startTime = options.startTime || 0;
        const stopTime = options.stopTime || video.duration;
        const effectiveDuration = stopTime - startTime;
        const currentPosition = Math.max(0, video.currentTime - startTime);
        this.videoProgress = (currentPosition / effectiveDuration) * 100;
      });
    }

    // Update play button and state when video state changes
    video.addEventListener('play', () => {
      // Disable any native subtitle tracks immediately when video starts playing
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = 'disabled';
      }
      
      playButton.innerHTML = "⏸"; // Pause icon
      if (options.storeAsCurrentVideo) {
        this.isPlaying = true;
        // Set as currently playing video for subtitle display
        this.currentlyPlayingVideo = video;
      } else {
        // For regular video overlays, sync with animation controls
        const animationIndex = this.findAnimationIndexByVideo(x, y, videoUrl);
        if (animationIndex !== -1) {
          this.animationIndex = animationIndex;
          this.currentVideo = video; // Set this video as the current video for animation controls
          this.enableProgressTracking(video); // Enable progress tracking
          this.isPlaying = true;
          if (!this.showingAnimations) {
            this.showingAnimations = true;
          }
        }
      }
      // Update currently playing video reference for play button videos
      if (!options.storeAsCurrentVideo && !options.trackProgress) {
        this.currentlyPlayingVideo = video;
      }
      // Bring video to front when it starts playing
      bringToFront();
    });

    video.addEventListener('pause', () => {
      playButton.innerHTML = "▶"; // Play icon
      if (options.storeAsCurrentVideo) {
        this.isPlaying = false;
        // Clear currently playing video for subtitle display
        if (this.currentlyPlayingVideo === video) {
          this.currentlyPlayingVideo = null;
          this.clearGlobalSubtitles();
        }
      } else {
        // For regular video overlays, sync with animation controls
        const animationIndex = this.findAnimationIndexByVideo(x, y, videoUrl);
        if (animationIndex !== -1 && this.animationIndex === animationIndex) {
          this.isPlaying = false;
          // Clear current video reference if this was the current video
          if (this.currentVideo === video) {
            this.disableProgressTracking(video);
            this.currentVideo = null;
          }
        }
      }
      // Clear currently playing video reference if this video was paused
      if (this.currentlyPlayingVideo === video) {
        this.currentlyPlayingVideo = null;
      }
    });

    video.addEventListener('ended', () => {
      if (options.storeAsCurrentVideo) {
        this.isPlaying = false;
        // Clear currently playing video and subtitles when video ends
        if (this.currentlyPlayingVideo === video) {
          this.currentlyPlayingVideo = null;
          this.clearGlobalSubtitles();
        }
      } else {
        // For regular video overlays, sync with animation controls
        const animationIndex = this.findAnimationIndexByVideo(x, y, videoUrl);
        if (animationIndex !== -1 && this.animationIndex === animationIndex) {
          this.isPlaying = false;
          // Clear current video reference if this was the current video
          if (this.currentVideo === video) {
            this.disableProgressTracking(video);
            this.currentVideo = null;
          }
        }
      }
      // Clear currently playing video reference when video ends
      if (this.currentlyPlayingVideo === video) {
        this.currentlyPlayingVideo = null;
      }
      if (options.playNextOnEnd) {
        console.log('Video ended, playing next animation');
        this.playNextAnimationInSequence();
      }
    });

    // Handle video loading and auto-play
    video.addEventListener('loadeddata', () => {
      // Set start time when video is loaded
      if (options.startTime !== undefined) {
        video.currentTime = options.startTime;
      }

      if (options.autoPlay) {
        // Show video when auto-playing
        video.style.display = "block";
        this.videoVisibilityState.set(video, true);
        
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
      } else {
        console.log('Video loaded and ready to play');
      }
      // Update play button position when video loads
      updatePlayButtonPosition();
    });

    // Add overlay to viewer
    this.viewer.addOverlay({
      element: container,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });
  
    // Set initial z-index for video wrapper
    setTimeout(() => {
      const wrapperElement = container.parentElement;
      if (wrapperElement) {
        wrapperElement.style.zIndex = "5000"; // Below annotation markers
      }
      updatePlayButtonPosition();
    }, 50);
  
    // Store cleanup function to remove play button when video is removed
    const originalContainer = container as HTMLDivElement & { _playButton?: HTMLElement; _updatePosition?: () => void };
    originalContainer._playButton = playButton;
    originalContainer._updatePosition = updatePlayButtonPosition;
  
    // Track this video overlay for reliable removal
    this.videoOverlays.push(container);

    return container;
  }

  private moveToLocation(x: number, y: number, width: number, height: number, immediate: boolean = false, duration: number = 2) {
    if (!this.viewer) {
      console.warn('Viewer not initialized');
      return;
    }

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
      if (this.viewer) {
        this.viewer.animationTime = currentAnimationTime;
      }
    }, duration * 1000);
  }

  // Overloaded version for viewport-based positioning
  private moveToLocationWithViewport(x: number, y: number, zoom: number, immediate: boolean = false, duration: number = 2) {
    if (!this.viewer) {
      console.warn('Viewer not initialized');
      return;
    }

    // Use custom animation timing for smoother transitions
    const currentAnimationTime = this.viewer.animationTime;
    this.viewer.animationTime = immediate ? 0 : duration;

    // Convert the normalized coordinates (0-1) to OpenSeadragon viewport coordinates
    const viewportPoint = new OpenSeadragon.Point(x, y);
    
    // Set the zoom level and center the viewport on the specified point
    this.viewer.viewport.panTo(viewportPoint, false);
    this.viewer.viewport.zoomTo(zoom, viewportPoint, false);

    // Restore original animation time after transition
    setTimeout(() => {
      if (this.viewer) {
        this.viewer.animationTime = currentAnimationTime;
      }
    }, (immediate ? 0 : duration) * 1000);
  }

  closeAnnotationPanel() {
    // Reset selected annotation when panel is closed
    if (this.selectedAnnotationElement) {
      this.resetAnnotationStyle(this.selectedAnnotationElement);
      this.selectedAnnotationElement = null;
    }

    this.panelText = "";
    this.annotationImages = [];
    this.panelTitle = 'Annotation Details';
    this.currentAnnotationIndex = 0;
    this.panelTextIndex = 0;
    this.numPanels = 0;
    this.showIntroductionPanel = false;

    // Adjust viewport when panel is closed
    this.adjustViewportForPanel(false);
  }

  private adjustViewportForPanel(showPanel: boolean) {
    if (!this.viewer) return;

    const viewport = this.viewer.viewport;
    
    if (showPanel && !this.isViewportAdjusted) {
      // Store the current bounds before adjusting
      this.originalBounds = viewport.getBounds();
      this.isViewportAdjusted = true;

      const currentBounds = this.originalBounds;
      
      const zoomFactor = 1 / 0.75; 
      const newWidth = currentBounds.width * zoomFactor;
      const newHeight = currentBounds.height * zoomFactor;
      
      const shiftPercentage = -0.035; 
      const shiftAmount = newWidth * shiftPercentage;
      
      // Shift viewport to the LEFT (subtract from x) to move image LEFT
      const newX = currentBounds.x - shiftAmount;
      const newY = currentBounds.y - (newHeight - currentBounds.height) / 2; // Center vertically

      const newBounds = new OpenSeadragon.Rect(newX, newY, newWidth, newHeight);
      
      // Animate to new bounds
      viewport.fitBounds(newBounds, false);
      
    } else if (!showPanel && this.isViewportAdjusted) {
      // Restore original bounds
      if (this.originalBounds) {
        viewport.fitBounds(this.originalBounds, false);
      }
      this.isViewportAdjusted = false;
      this.originalBounds = null;
    }
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  openAboutModal() {
    this.isAboutModalOpen = true;
    this.closeMenu(); // Close the menu when opening about modal
  }

  closeAboutModal() {
    this.isAboutModalOpen = false;
  }

  openIntroModal() {
    this.isIntroModalOpen = true;
    this.closeMenu(); // Close the menu when opening intro modal
  }

  closeIntroModal() {
    this.isIntroModalOpen = false;
  }

  // Enhanced chat methods
  toggleChat(show: boolean) {
    this.showingChat = show;
    if (show) {
      // Turn off annotations when chat is opened
      this.showingAnnotations = false;
      this.removeAnnotations();

      // Hide annotation panel when chat is opened
      this.closeAnnotationPanel();

      // Adjust viewport for chat panel
      this.adjustViewportForPanel(true);

      // Add welcome message if chat is empty
      if (this.chatMessages.length === 0) {
        this.addWelcomeMessage();
      }
    } else {
      this.adjustViewportForPanel(false);
    }
  }

  private addWelcomeMessage() {
    const welcomeMessages = {
      'Hogarth': "Greetings! I am William Hogarth, painter of moral tales and observer of human folly. What would you like to know about my Election Series?",
      'Sir Commodity Taxem': "Good day! I am Sir Commodity Taxem, candidate for the New Interest. How may I assist you in understanding the electoral process?",
      'Election Agent': "Ah, another observer of our democratic proceedings! I manage the practical affairs of elections. What brings you here?",
      'Serving Boy': "Hello there! I've seen much from my position serving at the tavern. What would you like to know?",
      'Fiddling Nan': "Well hello! I play my fiddle for all sorts of gatherings. Music tells stories too, you know!"
    };

    this.chatMessages.push({
      content: welcomeMessages[this.selectedCharacter] || welcomeMessages['Hogarth'],
      role: 'assistant',
      timestamp: new Date(),
      character: this.selectedCharacter
    });
  }

  selectCharacter(character: string) {
    if (character !== this.selectedCharacter) {
      this.selectedCharacter = character;
      this.chatService.setCurrentCharacter(character);
      
      // Clear existing messages and add new welcome message
      this.chatMessages = [];
      this.addWelcomeMessage();
    }
  }

  sendChatMessage() {
    if (this.currentMessage.trim() && !this.isLoadingChatResponse) {
      // Add user message
      const userMessage: ChatMessage = {
        content: this.currentMessage,
        role: 'user',
        timestamp: new Date()
      };
      
      this.chatMessages.push(userMessage);
      this.isLoadingChatResponse = true;

      // Get current painting information to provide context
      const paintingTitles = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];
      const currentPaintingTitle = paintingTitles[this.pageIndex];
      const paintingContext = ` (I'm viewing the painting "${currentPaintingTitle}")`;
      
      // Prepend painting context to user message for AI
      const contextualMessage = this.currentMessage + paintingContext;

      // Send to AI service
      this.chatService.sendMessage(contextualMessage).subscribe({
        next: (response) => {
          console.log('Chat response:', response);
          
          // Add AI response
          const aiMessage: ChatMessage = {
            content: response.data?.reply?.content?.[0]?.value || response.data?.content || response.message || "I'm afraid I didn't quite catch that. Could you rephrase?",
            role: 'assistant',
            timestamp: new Date(),
            character: this.selectedCharacter
          };
          
          this.chatMessages.push(aiMessage);
          this.isLoadingChatResponse = false;
          
          // Scroll to bottom of chat
          setTimeout(() => this.scrollChatToBottom(), 100);
        },
        error: (error) => {
          console.error('Chat error:', error);
          
          // Add error message
          const errorMessage: ChatMessage = {
            content: "My apologies, but I seem to be having trouble hearing you at the moment. Please try again.",
            role: 'assistant',
            timestamp: new Date(),
            character: this.selectedCharacter
          };
          
          this.chatMessages.push(errorMessage);
          this.isLoadingChatResponse = false;
        }
      });

      this.currentMessage = '';
    }
  }

  private scrollChatToBottom() {
    try {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling chat:', err);
    }
  }

  clearChat() {
    this.chatMessages = [];
    this.addWelcomeMessage();
  }

  private setDefaultAnnotationContent() {
     // Find the Introduction annotation for the current page
    const paintingTitles = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];
    const currentPaintingTitle = paintingTitles[this.pageIndex];
    
    const introAnnotation = this.annotations.find(annotation => 
      annotation["painting title"] === currentPaintingTitle && 
      annotation["annotation title"] === "Introduction"
    );

    if (introAnnotation) {
      this.panelTitle = introAnnotation["annotation title"];
      this.panelText = this.formatPanelText(introAnnotation["annotation text 0"]);
      this.currentAnnotationIndex = -1; // Indicate this is default content, not a specific annotation
      this.panelTextIndex = 0;
      
      // Count how many text panels this introduction has
      this.numPanels = 0;
      if (introAnnotation["annotation text 0"] && introAnnotation["annotation text 0"].length > 0) this.numPanels = 1;
      if (introAnnotation["annotation text 1"] && introAnnotation["annotation text 1"].length > 0) this.numPanels = 2;
      if (introAnnotation["annotation text 2"] && introAnnotation["annotation text 2"].length > 0) this.numPanels = 3;
      if (introAnnotation["annotation text 3"] && introAnnotation["annotation text 3"].length > 0) this.numPanels = 4;
      
      // Get images for the introduction if any
      const imageFilename = introAnnotation[`image filename 0`];
      this.loadImagesFromFilename(imageFilename);
    } 
  }

  showIntroduction() {
    // Enable annotations if not already enabled
    if (!this.showingAnnotations) {
      this.showingAnnotations = true;
      this.addAnnotations(this.annotations);
    }

    // Close chat if open
    if (this.showingChat) {
      this.showingChat = false;
      this.adjustViewportForPanel(false);
    }

    // Enable Introduction panel display
    this.showIntroductionPanel = true;

    // Set the default annotation content (Introduction)
    this.setDefaultAnnotationContent();

    // Adjust viewport for annotation panel
    this.adjustViewportForPanel(true);
  }

    showHelp() {
    // Enable annotations if not already enabled
    if (!this.showingAnnotations) {
      this.showingAnnotations = true;
      this.addAnnotations(this.annotations);
    }

    // Close chat if open
    if (this.showingChat) {
      this.showingChat = false;
      this.adjustViewportForPanel(false);
    }

    // Set help content without toggles (they'll be shown via Angular template)
    this.panelTitle = "Help - Explore Further";
    // ...existing code...
    this.panelText = `
          <p>Use the toggles below to enable different features and explore the rest of the painting by zooming in, clicking on other annotations, or listen to what the characters themselves have to say...</p>
          <p>Navigate between paintings using the arrows at the top, or zoom in and explore the details of each scene.</p>
        `;
    // ...existing code...
    this.currentAnnotationIndex = -2; // Special index for help content
    this.panelTextIndex = 0;
    this.numPanels = 1;
    this.annotationImages = [];

    // Adjust viewport for annotation panel
    this.adjustViewportForPanel(true);
  }

  private setupHelpToggleListeners() {
    // Remove existing listeners first
    document.removeEventListener('toggleAnimations', this.handleAnimationsToggle);
    document.removeEventListener('toggleAnnotations', this.handleAnnotationsToggle);

    // Add new listeners
    document.addEventListener('toggleAnimations', this.handleAnimationsToggle);
    document.addEventListener('toggleAnnotations', this.handleAnnotationsToggle);
  }

  private handleAnimationsToggle = (event: any) => {
    this.toggleAnimations(event.detail);
  }

  private handleAnnotationsToggle = (event: any) => {
    this.toggleAnnotations(event.detail);
  }

  /**
   * Find the animation index that corresponds to a video with the given coordinates and URL
   */
  private findAnimationIndexByVideo(x: number, y: number, videoUrl: string): number {
    for (let i = 0; i < this.animations.length; i++) {
      const animation = this.animations[i];
      if (animation.x === x && animation.y === y && animation.videoUrl === videoUrl) {
        return i;
      }
    }
    return -1; // Not found
  }

  /**
   * Sync the animation controls with the specified animation index and show playing state
   */
  private syncWithAnimationControls(animationIndex: number, currentVideo?: HTMLVideoElement): void {
    console.log('Syncing animation controls to index:', animationIndex);
    
    // Set the animation index
    this.animationIndex = animationIndex;
    
    // Show animation controls if they're not already visible
    if (!this.showingAnimations) {
      this.showingAnimations = true;
    }
    
    // Set the current video reference if provided
    if (currentVideo) {
      this.currentVideo = currentVideo;
      // Enable progress tracking for this video
      this.enableProgressTracking(currentVideo);
    }
    
    // Set playing state to true
    this.isPlaying = true;
    
    // Move to the animation location
    this.moveToAnimation(this.animationIndex);
  }

  /**
   * Enable progress tracking for a video element
   */
  private enableProgressTracking(video: HTMLVideoElement): void {
    // Remove any existing progress tracking listeners to avoid duplicates
    video.removeEventListener('loadedmetadata', this.progressMetadataHandler);
    video.removeEventListener('timeupdate', this.progressTimeUpdateHandler);
    
    // Add new progress tracking listeners
    video.addEventListener('loadedmetadata', this.progressMetadataHandler);
    video.addEventListener('timeupdate', this.progressTimeUpdateHandler);
    
    // If metadata is already loaded, calculate duration immediately
    if (video.duration && !isNaN(video.duration)) {
      this.videoDuration = video.duration;
    }
  }

  /**
   * Disable progress tracking for a video element
   */
  private disableProgressTracking(video: HTMLVideoElement): void {
    video.removeEventListener('loadedmetadata', this.progressMetadataHandler);
    video.removeEventListener('timeupdate', this.progressTimeUpdateHandler);
    // Reset progress values
    this.videoProgress = 0;
    this.videoDuration = 0;
  }

  private progressMetadataHandler = (event: Event) => {
    const video = event.target as HTMLVideoElement;
    this.videoDuration = video.duration;
  }

  private progressTimeUpdateHandler = (event: Event) => {
    const video = event.target as HTMLVideoElement;
    if (video === this.currentVideo) {
      this.videoProgress = (video.currentTime / video.duration) * 100;
    }
  }

  /**
   * Check if the current animation has subtitles available
   */
  currentAnimationHasSubtitles(): boolean {
    if (this.animations.length === 0 || this.animationIndex >= this.animations.length) {
      return false;
    }
    const currentAnimation = this.animations[this.animationIndex];
    return !!(currentAnimation.subtitles && 
              ((Array.isArray(currentAnimation.subtitles) && currentAnimation.subtitles.length > 0) ||
               (typeof currentAnimation.subtitles === 'string' && currentAnimation.subtitles.trim().length > 0)));
  }

  /**
   * Toggle mute state for all videos
   */
  toggleMute(): void {
    this.isMuted = !this.isMuted;
    
    // Apply mute state to all video elements in video overlays
    this.videoOverlays.forEach(overlay => {
      const video = overlay.querySelector('video');
      if (video) {
        video.muted = this.isMuted;
      }
    });

    // Also apply to current video if it exists
    if (this.currentVideo) {
      this.currentVideo.muted = this.isMuted;
    }

    // Apply to currently playing video if it exists and is different from current video
    if (this.currentlyPlayingVideo && this.currentlyPlayingVideo !== this.currentVideo) {
      this.currentlyPlayingVideo.muted = this.isMuted;
    }
  }

  /**
   * Toggle subtitle display for videos
   */
  toggleSubtitles(): void {
    this.subtitlesEnabled = !this.subtitlesEnabled;
    
    // If subtitles are disabled, clear the global subtitle container
    if (!this.subtitlesEnabled) {
      this.clearGlobalSubtitles();
    }

    // Ensure all video tracks are disabled (we handle subtitles globally now)
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled'; // Always disabled - we use global container
      }
    });
  }

}
