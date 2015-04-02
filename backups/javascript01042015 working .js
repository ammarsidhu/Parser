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
        streetViewControl: false, // hide street view
        overviewMapControl: false, // hide overview 
        rotateControl: false // disable rotate
    };
    
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    
    getdata();
    
    testgeo();
    
    //moreAddresses();
    
}

function getdata(){
    $.ajaxSetup( { "async": false } );
    $.getJSON('data1.json', function (data1) {
        data = data1;
    });	
    $.ajaxSetup( { "async": true } );
}

function testgeo(){
    //alert("testgeo: " + data[1].latitude);
    var stack = [];
    for (var i in data) {
        if (data[i].geocode === false){
            /*(geocode(i,data[i])).then(function(results){
                      data[results[2]].latitude = results[0];
                        data[results[2]].longitude = results[1];
                        data[results[2]].geocode = true;
                        //var position =  new google.maps.LatLng(results[0], results[1]);  
                        //addMarker(data[results[2]], position);
                    }, function() {
                      console.log("the deferred got rejected");
                    });*/
            stack.push(geocode(i,data[i]));
        }
    }
    
    $.when.apply($, stack).done(function() {
        moreAddresses();
    });
}



function geocode(index, data1){
    //deferred = new $.Deferred();
    //alert("geocode outside: " + data1.city + " text " + data1.text);
    geocoder = new google.maps.Geocoder();
    return $.Deferred(function(deferred) {
        geocoder.geocode( { 'address': data1.city}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                /*
                data[index].latitude = results[0].geometry.location.lat();
                data[index].longitude = results[0].geometry.location.lng();
                data[index].geocode = true;
                addMarker(data, results[0].geometry.location);
                */
                //alert("geocode inside: " + data.city + " text " + data.text);
                //callback(results);
                
                //var r = [results[0].geometry.location.lat(), results[0].geometry.location.lng(), index];
                //deferred.resolve(r);

                data[index].latitude = results[0].geometry.location.lat();
                data[index].longitude = results[0].geometry.location.lng();
                data[index].geocode = true;
                deferred.resolve();

            } else {
                alert("Geocode failed: " + status);
            }
        });
    });
    //return deferred.promise();
}

/* function geocode(index, data, callback){
    deferred = new $.Deferred();
    //alert("geocode outside: " + data.city + " text " + data.text);
    geocoder.geocode( { 'address': data.city}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            /*
            data[index].latitude = results[0].geometry.location.lat();
            data[index].longitude = results[0].geometry.location.lng();
            data[index].geocode = true;
            addMarker(data, results[0].geometry.location);
            */
            //alert("geocode inside: " + data.city + " text " + data.text);
            //callback(results);
/*
            deferred.resolve(results);
        } else {
            alert("Geocode failed: " + status);
        }
    });
    return deferred.promise();
}*/





	
function moreAddresses() {
        for (var i in data) {
            if (data[i].city in cityToMarkersArray){
                addExisting(data[i],i);
            }
            else{
                if (data[i].geocode === false){
                    ioutside = i;
                    //alert("moreadd out: " + data[i].city + " text" + data[i].text);
                    /*geocode(i, data[i],function(results){
                        alert("moreadd in: " + data[ioutside].city + " text" + data[ioutside].text);
                        data[ioutside].latitude = results[0].geometry.location.lat();
                        data[ioutside].longitude = results[0].geometry.location.lng();
                        data[ioutside].geocode = true;
                        addMarker(data[ioutside], results[0].geometry.location);
                    });*/
                    /*(geocode(i,data[i])).then(function(results){
                      data[results[2]].latitude = results[0];
                        data[results[2]].longitude = results[1];
                        data[results[2]].geocode = true;
                        var position =  new google.maps.LatLng(results[0], results[1]);  
                        addMarker(data[results[2]], position);
                    }, function() {
                      console.log("the deferred got rejected");
                    });*/
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
    var string = '<a href="#a' + markers.length + '">' + data.text +  "</a>";
    marker.info = new google.maps.InfoWindow({
          content: "<h3>"+ data.city + "</h3>" + string
        });

    google.maps.event.addListener(marker, 'click', function() {
            marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png');
            markers[clickindex].setIcon('http://maps.google.com/mapfiles/marker.png');
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
    markers.push(marker);
    cityToMarkersArray[data.city] = markers.length - 1;
    textToMarkersArray[data.text] = markers.length - 1;
    textArray.push(data.text);
    idNametoArray["a" + (markers.length - 1) ] = markers.length - 1;
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
    
    marker.info = new google.maps.InfoWindow({
          content: content
    });

    google.maps.event.addListener(marker, 'click', function() {
            clickindex = index;
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
    idNametoArray["a" + (markers.length - 1) ] = index;
    
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
            var stringreplace = '<a id="a' + i + '" style="background-color:yellow" href="#" onclick="centerOnMarker(this.text);">' + textArray[i] + "</a>";
            data = data.replace(textArray[i], stringreplace);
        }
        document.getElementById("inputtext").innerHTML = data;
    });
}



function centerOnMarker(text){
    
    var index = textToMarkersArray[text];
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
        showsubsetoflines(index);
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
        pathlineArray[i].setMap(map);     
    }
}
		
		
google.maps.event.addDomListener(window, 'load', initialise);
