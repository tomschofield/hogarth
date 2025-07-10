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

  constructor(private router: Router) { }

  ngAfterViewInit() {
    // Ensure video plays after view init
    this.playVideo();
    this.setupVideoProgressTracking();
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