import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ManifestService {

  constructor(private http: HttpClient) { }
   data: any;
<<<<<<< Updated upstream
  configUrl: string = "https://api-ecppec.ncl.ac.uk/api/manifests/e250cf21-a2d6-4a9d-ae7b-ae0c4420bda1";
  //configUrl: string = "http://localhost:3000/api/manifests/deb3ae11-09ea-45f4-babe-df81f2975c5c";
=======
   configUrl: string = "https://api-ecppec.ncl.ac.uk/api/manifests/e250cf21-a2d6-4a9d-ae7b-ae0c4420bda1";
>>>>>>> Stashed changes
  getData(){
    this.data= "Test";
    return  this.http.get<any>(this.configUrl);
  }
}
