import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ManifestService {

  constructor(private http: HttpClient) { }
   data: any;
   configUrl: string = "http://api-ecppec.ncl.ac.uk/api/manifests/e250cf21-a2d6-4a9d-ae7b-ae0c4420bda1";
  getData(){
    this.data= "Test";
    return  this.http.get<any>(this.configUrl);
  }
}
