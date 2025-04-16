import { Component, OnInit, NgZone, ElementRef } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { ManifestService } from './manifest.service';
import { CanvasDatum } from './canvas-datum';
declare var OpenSeadragon: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})


export class AppComponent implements OnInit {
  title = 'hogarth';
  viewer: any;
  Mirador: any;
  config: any;
  canvasData: CanvasDatum [] = [];//| undefined;
  // canvasData: string;
  constructor(private ngZone: NgZone, private manifestService: ManifestService) { }
  ngOnInit() {
      this.manifestService.getData().subscribe(res => {
        this.config = res;
        // console.log(this.config);
        // console.log(this.config.sequences);
        // console.log(this.config.sequences[0]);
        // console.log(this.config.sequences[0].canvases);

        // let numCanvases = this.config.sequences[0].canvases.length;
        // console.log("numcanvases",numCanvases);

        



        

        this.config.sequences[0].canvases.forEach((element) => {
          let da:CanvasDatum = {
            id:element.images[0].resource.service["@id"],
            height:element.images[0].resource["height"],
            width:element.images[0].resource["width"]
          }
          this.canvasData.push(da);
        });
        // console.log("this.canvasData",this.canvasData);
        // console.log(this.config.sequences[0].canvases);

        // console.log(this.config.sequences[0].canvases[0].images[0].resource.service["@id"]);
        let id:string = this.config.sequences[0].canvases[0].images[0].resource.service["@id"];
        let height:number = this.config.sequences[0].canvases[0].images[0].resource["height"];
        let width:number = this.config.sequences[0].canvases[0].images[0].resource["width"];
        // let id:string = this.config.sequences[0].canvases[0].images[0].resource[""];

        
        let tileSources: any[] = [];
        this.canvasData.forEach(element => {
          tileSources.push({
            "@context": "http://iiif.io/api/image/2/context.json",
              "@id": "",
              "height": -1,
              "width": -1,
              "profile": ["http://iiif.io/api/image/2/level2.json"],
              "protocol": "http://iiif.io/api/image",
                  overlays: [{
                  id: 'image-ruler',
                  x: 0,
                  y: 0,
                  width: 0.5,
                  height: 0.4,
                  className: 'highlight'
              }],
              "tiles": [{
                "scaleFactors": [1, 2, 4, 8, 16, 32],
                "width": 1024,
         
              }],
          })
        });
        let index:number = 0;
        this.canvasData.forEach(element => {
          console.log(element);
          tileSources[index]["@id"]=element["id"]; 
          tileSources[index]["height"]=element["height"]; 
          tileSources[index]["width"]=element["width"]; 
          index++;
        });
        console.log(tileSources);
        this.viewer = new OpenSeadragon.Viewer({
          id: "seadragon-viewer",
          sequenceMode: true,
          showHomeControl: true,
          showZoomControl: false,
          showFullPageControl: true,
          showRotationControl: false,
          showFlipControl: false,
          showSequenceControl: true,
          navigatorBackground: "black",
          prefixUrl: "//openseadragon.github.io/openseadragon/images/",
          // tileSources: [{
          //   "@context": "http://iiif.io/api/image/2/context.json",
          //   "@id": id,//"https://api-ecppec.ncl.ac.uk:8183/iiif/3/JS_FEB_2025_06.jpg",
          //   "height": height,
          //   "width": width,
          //   "profile": ["http://iiif.io/api/image/2/level2.json"],
          //   "protocol": "http://iiif.io/api/image",
          //       overlays: [{
          //       id: 'image-ruler',
          //       x: 0,
          //       y: 0,
          //       width: 0.5,
          //       height: 0.4,
          //       className: 'highlight'
          //   }],
          //   "tiles": [{
          //     "scaleFactors": [1, 2, 4, 8, 16, 32],
          //     "width": 1024,
       
          //   }],
    
           
          // },
    
          // ]
          tileSources:tileSources
    
        });
        // var overlay = this.viewer.addOverlay("image-ruler", new OpenSeadragon.Point(0.5, 0.5), OpenSeadragon.Placement.CENTER);
        this.viewer.addHandler('canvas-click', (event: any) => {
          var size = 0.2;
          var element = document.getElementById("image-ruler");
        //  this.viewer.removeOverlay(element);
          if (event.quick) {
    
            var point = event.position;
            console.log(event);
            console.log(point);
            var vp = this.viewer.viewport.viewerElementToViewportCoordinates(point);
            var box = new OpenSeadragon.Rect(vp.x - size / 2, vp.y - size / 2, size, size);
            console.log(box)
    
          }
        });
        this.viewer.addHandler('open', function () {
    
    
    
    
        });
      },
      error => { 
        console.log("Error happened" + error)
      }
      );
//overlays comes after tilesources      
      // overlays: [{
      //   id: 'example-overlay',
      //   x: 0.33,
      //   y: 0.75,
      //   width: 0.2,
      //   height: 0.25,
      //   className: 'highlight'
      // }],

    


    

    console.log(this.viewer);
  }
}

