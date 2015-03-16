/*global google */
/*global alert */
/*global window */
var map;
var geocoder;
var i = 0;
var count;
var pathLatLng = [];
var markers = [];
var cityToMarkersArray = {};
var textToMarkersArray = {};


function initialise() {
	$("#inputtext").load("sample.txt");
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
    moreAddresses();

}
		
				

		
		
function moreAddresses() {


$.getJSON('data1.json', function (data) {
        for (var i in data)(function(i) {
        if (data[i].city in cityToMarkersArray){
            addExisting(data[i]);
        }
        else{
            if (data[i].geocode === false){
                geocoder.geocode( { 'address': data[i].city}, function(results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        addMarker(data[i], results[0].geometry.location);
                        pathLatLng.push( new google.maps.LatLng(results[0].geometry.location.lat(), results[0].geometry.location.lng()));
                    } else {
                        alert("Geocode failed: " + status);
                    }
                });
            }
            else{
                var position =  new google.maps.LatLng(data[i].latitude, data[i].longitude);   
                addMarker(data[i],position);
            }

        }
        })(i);
    });

}
		
function addMarker(data, location){

    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });				            
    marker.info = new google.maps.InfoWindow({
          content: "<h3>"+ data.city + "</h3>" + "<p>" + data.text +  "</p>"
        });

    google.maps.event.addListener(marker, 'click', function() {
          marker.info.open(map, marker);
        });
    markers.push(marker);
    cityToMarkersArray[data.city] = markers.length - 1;
    textToMarkersArray[data.text] = markers.length - 1;
    addLine(location);

}
		
function addExisting(data){

    var index = cityToMarkersArray[data.city];
    var content = markers[index].info.getContent(this);
    var location = markers[index].position;

    content = content + "<p>" + data.text +  "</p>";
    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });
    
    marker.info = new google.maps.InfoWindow({
          content: content
    });

    google.maps.event.addListener(marker, 'click', function() {
          marker.info.open(map, marker);
    });
    
    markers[index] = marker;
    textToMarkersArray[data.text] = index;

    addLine(location);
}
		
function addLine (position){
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

    pathline.setMap(map);
}
		
		
google.maps.event.addDomListener(window, 'load', initialise);
