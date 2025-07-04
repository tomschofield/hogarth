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

  constructor(private router: Router) { }

  ngAfterViewInit() {
    // Ensure video plays after view init
    this.playVideo();
  }

  async playVideo() {
    try {
      await this.videoElement.nativeElement.play();
      console.log('Video started playing');
      this.showPlayButton = false;
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
    // Don't auto-play here to avoid double play attempts
  }

  onVideoError(event: any) {
    console.error('Video error:', event);
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