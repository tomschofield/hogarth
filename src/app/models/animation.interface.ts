export interface Animation {
  title: string;
  canvasIndex: number;
  storyIndex: number;
  transcript: string;
  videoUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  duration?: number;
  hideControls?: boolean;
  startTime?: number;
  stopTime?: number;
  navigationCues?: NavigationCue[];
  // New viewport properties for enhanced positioning control
  viewportX?: number;     // Optional x position for viewport center (0-1)
  viewportY?: number;     // Optional y position for viewport center (0-1)
  viewportZoom?: number;  // Optional zoom level (e.g., 1.0 = fit bounds, 2.0 = 2x zoom)
  // Subtitle support - both inline and WebVTT
  subtitles?: Subtitle[] | string;  // Inline subtitles array or path to WebVTT file
  showSubtitles?: boolean;          // Whether to show subtitles by default
  subtitleLanguage?: string;        // Language code (e.g., 'en', 'es', 'fr') for WebVTT files
}

export interface Subtitle {
  start: number;    // Start time in seconds
  end: number;      // End time in seconds
  text: string;     // Subtitle text (can include basic HTML)
  position?: SubtitlePosition; // Optional positioning
}

export interface SubtitlePosition {
  x?: number;       // Horizontal position (0-1, default: 0.5 for center)
  y?: number;       // Vertical position (0-1, default: 0.9 for bottom)
  align?: 'left' | 'center' | 'right';  // Text alignment
}

export interface NavigationCue {
  time: number;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  // Optional viewport properties for enhanced navigation positioning
  viewportX?: number;     // Optional x position for viewport center (0-1)
  viewportY?: number;     // Optional y position for viewport center (0-1)
  viewportZoom?: number;  // Optional zoom level (e.g., 1.0 = fit bounds, 2.0 = 2x zoom)
}