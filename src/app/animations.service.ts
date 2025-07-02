import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AnimationsService {

  constructor(private http: HttpClient) { }
   data: any;
   configUrl: string = "assets/data/animations.json";
  getData(){
    // this.data= "Test";
    return  this.http.get<any>(this.configUrl);
  }
}
