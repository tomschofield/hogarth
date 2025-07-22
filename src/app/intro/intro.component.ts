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

  constructor(private router: Router) { 
    this.adaptiveVideoUrl = this.getOptimalVideoUrl('assets/videos/Hogarth.mp4');
  }

  ngAfterViewInit() {
    // Set the adaptive video source
    this.videoElement.nativeElement.src = this.adaptiveVideoUrl;
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
      
      // Store current playback time and state
      this.currentTime = video.currentTime;
      const wasPlaying = !video.paused;
      
      // Update the video source
      this.adaptiveVideoUrl = newVideoUrl;
      video.src = this.adaptiveVideoUrl;
      
      // When the new video loads, restore playback position and state
      const loadedHandler = () => {
        video.currentTime = this.currentTime;
        
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

  toggleVideoPause() {
    const video = this.videoElement.nativeElement;
    
    if (this.isVideoPaused) {
      video.play();
      this.isVideoPaused = false;
    } else {
      video.pause();
      this.isVideoPaused = true;
    }
  }

  async playVideo() {
    try {
      await this.videoElement.nativeElement.play();
      console.log('Video started playing');
      this.showPlayButton = false;
      this.isVideoPaused = false;
    } catch (error) {
      console.warn('Autoplay failed:', error);
      // Show play button when autoplay fails
      this.showPlayButton = true;
    }
  }

  onPlayButtonClick() {
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
    video.currentTime = video.duration;
    
    // Trigger the same behavior as when video ends
    this.onVideoEnded();
  }

  playAgain() {
    // Reset the video to beginning and play again
    const video = this.videoElement.nativeElement;
    video.currentTime = 0;
    this.showContent = false;
    this.showStartButton = false;
    this.playVideo();
  }

}