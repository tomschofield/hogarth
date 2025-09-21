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