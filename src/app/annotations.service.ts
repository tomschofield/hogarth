import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AnnotationsService {

  constructor(private http: HttpClient) { }
   data: any;
   configUrl: string = "assets/data/annotations.json";
  getData(){
    this.data= "Test";
    return  this.http.get<any>(this.configUrl);
  }
}
