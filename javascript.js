/*global google */
/*global alert */
/*global window */
var map;
var geocoder;
var i = 0;
var count;
var pathlineArray = [];
var markers = [];
var cityToMarkersArray = {};
var textToMarkersArray = {};
var textArray = [];
var idNametoArray = {};
var data;
var lastposition;
var subsetflag = false;
var clickindex=0;


function initialise() {
    $(".highlight").css({ backgroundColor: "#FFFF88" });
    geocoder = new google.maps.Geocoder();
    
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
    }
    
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    
    getdata();
    
    testgeo();
    
    moreAddresses();
    
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
    for (var i in data) {
        if (data[i].geocode === false){
            geocode(i);
        }
    }
}

function geocode(index){
        geocoder.geocode( { 'address': data[index].city}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                //alert("data " +  data.city);
                //alert("lat: " +  results[0].geometry.location.lat() + "lng" +  results[0].geometry.location.lng());
                data[index].latitude = results[0].geometry.location.lat();
                data[index].longitude = results[0].geometry.location.lng();
                data[index].geocode = true;
                //addMarker(data, results[0].geometry.location);
                alert("geocode: " + data[1].latitude);
            } else {
                alert("Geocode failed: " + status);
            }
        });
    
    
}




	
function moreAddresses() {
    //alert("moreaddr: " + data[1].latitude);
        for (var i in data) {
            if (data[i].city in cityToMarkersArray){
                addExisting(data[i],i);
            }
            else{
                if (data[i].geocode === false){
                    geocode(i);
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
    var string = '<a href="#a' + markers.length + '">' + data.text +  "</a>";
    marker.info = new google.maps.InfoWindow({
          content: "<h3>"+ data.city + "</h3>" + string
        });

    google.maps.event.addListener(marker, 'click', function() {
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
    //pathline.setMap(map);
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
