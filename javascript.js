/*global google */
/*global alert */
/*global window */
var map;
var geocoder;
var pathlineArray = [];
var markers = [];
var textArray = [];
var cityToMarkersArray = {};    //convert city name to marker array index
var textToMarkersArray = {};    //convert text name to marker array index
var idNametoArray = {};         //convert html anchor to marker array index
var data;                       //hold json data
var lastposition;               //last position for lines
var subsetflag = false;         //flag for subset of lines
var clickindex=0;               //last icon clicked
var ioutside;
var nogeoarray = [];
var iter = 0;
var missinggeo = true;

function initialise() {
    
    
    var myLatlng = new google.maps.LatLng(43.650244, -79.390752); // Add the coordinates
    var mapOptions = {
        zoom: 4,
        minZoom: 3,
        maxZoom: 17,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.DEFAULT // Change to SMALL to force just the + and - buttons.
        },
        center: myLatlng, // Centre the Map to coordinates
        mapTypeId: google.maps.MapTypeId.ROADMAP, // type of Map
        scrollwheel: true,
        panControl: false,
        mapTypeControl: false, // map or satellite view
        scaleControl: false, //hide scale
        streetViewControl: true, // hide street view
        overviewMapControl: false, // hide overview 
        rotateControl: false // disable rotate
    };
    
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    
    getdata();
    //test1();
    testgeo();
    
    
}

function getdata(){
    $.ajaxSetup( { "async": false } );
    $.getJSON('data1.json', function (data1) {
        data = data1;
    });	
    $.ajaxSetup( { "async": true } );
}

function test1(index, data1){
    geocoder = new google.maps.Geocoder();
    return $.Deferred(function(deferred) {
        var url_addr = encodeURIComponent(data1.city);
        $.getJSON('geocode.php?addr='+url_addr, function(reqdata) { 
            var results = reqdata.results,
            status = reqdata.status;
            if (status == google.maps.GeocoderStatus.OK) {
                alert(results[0].geometry.location.lat);
                data[index].latitude = results[0].geometry.location.lat;
                data[index].longitude = results[0].geometry.location.lng;
                data[index].geocode = true;
                deferred.resolve();
            } else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
                nogeoarray.push(index);
                alert("Geocode failed: " + status);
                deferred.resolve();
            }else {
                alert("Geocode failed: " + status);
            }
        })
    });
}

function testgeo(){
    var deferstack = [];
    for (; iter < data.length; iter++ ) {
        if (data[iter].geocode === false){
                  //deferstack.push(geocode(iter,data[iter]));
                deferstack.push(test1(iter,data[iter]));
        }  
    }
    
    $.when.apply($, deferstack).done(function() {
                moreAddresses();
    });
}



function geocode(index, data1){
    geocoder = new google.maps.Geocoder();
    return $.Deferred(function(deferred) {
        geocoder.geocode( { 'address': data1.city}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {

                data[index].latitude = results[0].geometry.location.lat();
                data[index].longitude = results[0].geometry.location.lng();
                data[index].geocode = true;
                deferred.resolve();
                

            } else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
                nogeoarray.push(index);
                deferred.resolve();
            }else {
                alert("Geocode failed: " + status);
            }
        });
    });
}


	
function moreAddresses() {
        for (var i in data) {
            if (data[i].city in cityToMarkersArray){
                addExisting(data[i],i);
            }
            else{
                if (data[i].geocode === false){
                    alert("no geocode for:" + data[i].city);
                }
                else{
                    var position =  new google.maps.LatLng(data[i].latitude, data[i].longitude);   
                    addMarker(data[i],position);
                }

            }
        }
    convertToHtml();
    
    
}
    

		
function addMarker(data, location){
    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });	
    marker.setIcon('http://maps.google.com/mapfiles/marker.png');
    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>";
   
    marker.info = new google.maps.InfoWindow({
          content: "<h3>"+ data.city + "</h3>" + string
        });

    google.maps.event.addListener(marker, 'click', function() {
            for(i in markers){
                markers[i].setIcon('http://maps.google.com/mapfiles/marker.png');
            }
            marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png');
            clickindex = cityToMarkersArray[data.city];
            for(i in markers){
                markers[i].info.close();
            }
            marker.info.open(map, marker);
            if (subsetflag == true)
            {
                showsubsetoflines(cityToMarkersArray[marker.title]);
            }
        });
    cityToMarkersArray[data.city] = markers.length;
    textToMarkersArray[data.text] = markers.length;
    idNametoArray["a" + (markers.length) ] = markers.length;
    markers.push(marker);
    textArray.push(data.text);
    addLine(location);

}
		
function addExisting(data){
    var index = cityToMarkersArray[data.city];
    var content = markers[index].info.getContent(this);
    var location = markers[index].getPosition();
    markers[index].setMap(null);
    markers[index] = null;
    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>";

    content = content + "<p>" + string +  "</p>";
    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });
    marker.setIcon('http://maps.google.com/mapfiles/marker.png');
    
    marker.info = new google.maps.InfoWindow({
          content: content
    });
    

    google.maps.event.addListener(marker, 'click', function() {
            clickindex = index;
            for(i in markers){
                markers[i].setIcon('http://maps.google.com/mapfiles/marker.png');
            }
            marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png');
            for(i in markers){
                markers[i].info.close();
            }
            marker.info.open(map, marker);
            if (subsetflag == true)
            {
                showsubsetoflines(cityToMarkersArray[marker.title]);
            }
        
    });
    
    markers[index] = marker;
    textToMarkersArray[data.text] = index;
    textArray.push(data.text);
    idNametoArray["a" + (textArray.length - 1) ] = index;
    addLine(location);
}
		
function addLine (position){
    var pathLatLng = [];
    if (markers.length == 1){
        lastposition = position;
    }
    pathLatLng.push(lastposition);
    pathLatLng.push(position);

    var lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
    };

    var pathline = new google.maps.Polyline({
        path: pathLatLng,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2,
        icons: [{
            icon: lineSymbol,
            offset: '100%'
        }]
    });

    
    pathlineArray.push(pathline);
    lastposition = position;
    showline();
}

function convertToHtml(){
    jQuery.get('sample.txt', function(data) {
    var string = data;
    for (var i in textArray){
            //var stringreplace = '<a id="a' + i + '" style="background-color:yellow" href="#" onclick="centerOnMarker(this.text);">' + textArray[i] + "</a>";
            var stringreplace = '<a id="a' + i + '" style="background-color:yellow" href="#" onclick="centerOnMarker(this);">' + textArray[i] + "</a>";
            //data = data.replace(textArray[i], stringreplace);
            
            
            var num = textArray[i].split(' ');
            var t = num[0];
            for(i = 1; i < num.length; i++){
                t += "([\\s]*)" + num[i];
            }
            var regex = new RegExp(t);
            data = data.replace(regex, stringreplace);
            
        }
        document.getElementById("inputtext").innerHTML = data;
    });
}



function centerOnMarker(pass){
    
    var index = textToMarkersArray[pass.text];
    p = pass.id;
    var idnum = p.slice(1);
    markers[index].setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png');
    markers[clickindex].setIcon('http://maps.google.com/mapfiles/marker.png');
    for(i in markers){
                markers[i].info.close();
    }
    markers[index].info.open(map, markers[index]);
    var LatLng  = markers[index].getPosition();
    map.setCenter(LatLng);
    map.setZoom(6);
    clickindex = index;
    if (subsetflag == true)
    {
        showsubsetoflines(parseInt(idnum));
        
    }
}

function removeline(){
    for(i in pathlineArray){
        pathlineArray[i].setMap(null);
    }
}

function showline(){
    subsetflag = false;
    for(i in pathlineArray){
        pathlineArray[i].setMap(map);
    }
}


function showsubsetoflines(index){
    subsetflag = true;
    removeline();
    
    for(i = index - 1; i < index + 3; i++){
        if(i<0){
            i=0;
        }
        else if (i > pathlineArray.length - 1){
            i = pathlineArray.length - 1;
        }
            
        pathlineArray[i].setMap(map);     
    }
    
    
}

function wait(ms) {
      var deferred = $.Deferred();
      setTimeout(deferred.resolve, ms);

     // We just need to return the promise not the whole deferred.
     return deferred.promise();
  }

// Use it
//  wait(1500).then(function () {
      // Do something brilliant here!
//  });
  
		
		
google.maps.event.addDomListener(window, 'load', initialise);
