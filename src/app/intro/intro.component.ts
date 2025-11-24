import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.scss']
})
export class IntroComponent implements AfterViewInit {
  @ViewChild('backgroundVideo') videoElement!: ElementRef<HTMLVideoElement>;

  showContent = false;
  showStartButton = false;
  showPlayButton = false;
  isVideoLoading = true; 
  videoProgress = 0;
  isVideoPaused = false;
  adaptiveVideoUrl = '';
  private orientationChangeListener?: () => void;
  private currentTime = 0;
<<<<<<< Updated upstream
  
  // Menu properties
  isMenuOpen: boolean = false;
  isAboutModalOpen: boolean = false;
=======
>>>>>>> Stashed changes

  constructor(private router: Router) { 
    this.adaptiveVideoUrl = this.getOptimalVideoUrl('assets/videos/Hogarth.mp4');
  }

  ngAfterViewInit() {
    // Set the adaptive video source
    this.videoElement.nativeElement.src = this.adaptiveVideoUrl;
    // Start muted for autoplay compliance, will unmute after user interaction
    this.videoElement.nativeElement.muted = true;
    // Ensure video plays after view init
    this.playVideo();
    this.setupVideoProgressTracking();
    this.setupOrientationChangeListener();
  }

  ngOnDestroy() {
    if (this.orientationChangeListener) {
      window.removeEventListener('orientationchange', this.orientationChangeListener);
      window.removeEventListener('resize', this.orientationChangeListener);
    }
  }

  private setupOrientationChangeListener() {
    this.orientationChangeListener = () => {
      // Small delay to ensure the orientation change is complete
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100);
    };

    // Listen for both orientationchange and resize events
    window.addEventListener('orientationchange', this.orientationChangeListener);
    window.addEventListener('resize', this.orientationChangeListener);
  }

  private handleOrientationChange() {
    const newVideoUrl = this.getOptimalVideoUrl('assets/videos/Hogarth.mp4');
    
    // Only swap if the URL actually changed
    if (newVideoUrl !== this.adaptiveVideoUrl) {
      const video = this.videoElement.nativeElement;
      
      // Store current playback time, state, and audio settings
      this.currentTime = video.currentTime;
      const wasPlaying = !video.paused;
      const wasMuted = video.muted;
      
      // Update the video source
      this.adaptiveVideoUrl = newVideoUrl;
      video.src = this.adaptiveVideoUrl;
      
      // When the new video loads, restore playback position, state, and audio
      const loadedHandler = () => {
        video.currentTime = this.currentTime;
        video.muted = wasMuted; // Preserve audio settings
        
        if (wasPlaying && !this.isVideoPaused) {
          video.play().catch(console.error);
        }
        
        video.removeEventListener('loadeddata', loadedHandler);
      };
      
      video.addEventListener('loadeddata', loadedHandler);
    }
  }
  
  private getOptimalVideoUrl(baseVideoUrl: string): string {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isPortrait = screenHeight > screenWidth;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Determine optimal video quality based on screen size and pixel density
    if (isPortrait) {
      return baseVideoUrl.replace('.mp4', '_Portrait.mp4');
    } else {
      return baseVideoUrl
    }
  }

  setupVideoProgressTracking() {
    const video = this.videoElement.nativeElement;
    
    video.addEventListener('timeupdate', () => {
      if (video.duration > 0) {
        this.videoProgress = (video.currentTime / video.duration) * 100;
      }
    });

    video.addEventListener('loadedmetadata', () => {
      console.log('Video metadata loaded, duration:', video.duration);
    });
  }

  onProgressBarClick(event: MouseEvent) {
    const video = this.videoElement.nativeElement;
    
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

  private seekToTime(targetTime: number) {
    const video = this.videoElement.nativeElement;
    
    // Ensure video is not loading and has valid duration
    if (!video.duration || video.duration === Infinity || isNaN(video.duration)) {
      return;
    }

    // Clamp target time to valid range
    const clampedTime = Math.max(0, Math.min(targetTime, video.duration));
    
    // Store the current play state
    const wasPlaying = !video.paused && !this.isVideoPaused;
    
    // Seek to the target time
    video.currentTime = clampedTime;
    
    // Maintain play state after seeking
    if (wasPlaying) {
      video.play().catch(console.error);
    }
  }

  toggleVideoPause() {
    const video = this.videoElement.nativeElement;
    
    if (this.isVideoPaused) {
      // Ensure audio is enabled when resuming
      video.muted = false;
      video.play();
      this.isVideoPaused = false;
    } else {
      video.pause();
      this.isVideoPaused = true;
    }
  }

  async playVideo() {
    try {
      const video = this.videoElement.nativeElement;
      // Unmute the video when user initiates playback
      video.muted = false;
      await video.play();
      console.log('Video started playing with audio');
      this.showPlayButton = false;
      this.isVideoPaused = false;
    } catch (error) {
      console.warn('Autoplay failed:', error);
      // Show play button when autoplay fails
      this.showPlayButton = true;
    }
  }

  onPlayButtonClick() {
    // Ensure audio is enabled when user clicks play
    this.videoElement.nativeElement.muted = false;
    this.playVideo();
  }

  onVideoCanPlay() {
    console.log('Video can play');
    this.isVideoLoading = false;
    // Don't auto-play here to avoid double play attempts
  }

  onVideoError(event: any) {
    console.error('Video error:', event);
    this.isVideoLoading = false;
    // Show content immediately if video fails
    this.showContent = true;
    this.showStartButton = true;
    this.showPlayButton = false;
  }

  onVideoEnded() {
    this.showContent = true;
    this.showPlayButton = false;
    setTimeout(() => {
      this.showStartButton = true;
    }, 500);
  }

  startViewer() {
    this.router.navigate(['/viewer']);
  }

  skipVideo() {
    // Pause the video and skip to the end
    const video = this.videoElement.nativeElement;
    video.pause();
    
    // Check if video duration is available
    if (!video.duration || video.duration === Infinity || isNaN(video.duration)) {
      // If duration is not available, just show the content immediately
      this.onVideoEnded();
      return;
    }
    
    // Wait for the video to seek to the end frame before showing content
    const onSeeked = () => {
      // Give Safari a moment to render the frame
      setTimeout(() => {
        this.onVideoEnded();
      }, 100);
      video.removeEventListener('seeked', onSeeked);
    };
    
    // Add a timeout fallback in case seeking fails
    const timeoutId = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      this.onVideoEnded();
    }, 1000);
    
    video.addEventListener('seeked', () => {
      clearTimeout(timeoutId);
      onSeeked();
    });
    
    // Seek to just before the end to ensure we get a valid frame
    video.currentTime = Math.max(0, video.duration - 0.1);
  }

  playAgain() {
    // Reset the video to beginning and play again
    const video = this.videoElement.nativeElement;
    video.currentTime = 0;
    video.muted = false; // Ensure audio is enabled
    this.showContent = false;
    this.showStartButton = false;
    this.playVideo();
  }

<<<<<<< Updated upstream
  // Menu functionality methods
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

  // Add handler for modal close event
  onModalClose() {
    this.isAboutModalOpen = false;
  }
=======
>>>>>>> Stashed changes
}