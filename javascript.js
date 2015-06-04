/*global google */
/*global alert */
/*global window */
var map;
var geocoder;
var pathlineArray = [];
var markers = [];
var textArray = [];
var geonamesdatabasearray = [];
var nogeoarray = [];
var cityToMarkersArray = {};    //convert city name to marker array index
var textToMarkersArray = {};    //convert text name to marker array index
var idNametoMarkerArray = {};         //convert html anchor to marker array index
var data;                       //hold json data
var lastposition;               //last position for lines
var subsetflag = false;         //flag for subset of lines
var clickindex=0;               //last icon clicked
var ioutside;
var iter = 0;
var missinggeo = true;
var panorama;
var directionsService;
var scrollfilterflag = false;


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
    directionsService = new google.maps.DirectionsService();
    
    panorama = map.getStreetView();
    
    getdata();
    testgeo();
    
    
}

function getdata(){
    $.ajaxSetup( { "async": false } );
    $.getJSON('data1.json', function (data1) {
        data = data1;
    });	
    $.ajaxSetup( { "async": true } );
    
}


function testgeo(){
    var deferstack = [];
    for (; iter < data.length; iter++ ) {
        if (data[iter].geocode === false){
                deferstack.push(geocode(iter,data[iter]));
        }  
    }
    
    
    $.when.apply($, deferstack).done(function() {
                moreAddresses();
                //updategeonamesarray();
            console.table(data);
    });
}

function geocode(index, data1){
    geocoder = new google.maps.Geocoder();
    return $.Deferred(function(deferred) {
        var url_addr = encodeURIComponent(data1.city);
        $.getJSON('geocode.php?addr='+url_addr, function(reqdata) { 
            var results = reqdata.results,
            status = reqdata.status;
            if (status == google.maps.GeocoderStatus.OK) {
                var latitude = results[0].geometry.location.lat;
                var longitude = results[0].geometry.location.lng;
                var country;
                
                for (var i=0; i<results[0].address_components.length; i++) {
                    for (var b=0;b<results[0].address_components[i].types.length;b++) {
                        if (results[0].address_components[i].types[b] == "country") {
                            //this is the object you are looking for
                            country = results[0].address_components[i].short_name;  
                            break;
                        }
                    }
                }
                
                                
                if (typeof country == "undefined"){
                    country = "XX";
                }
                
                
                var locationdata = {name: data1.city, latitude:latitude, longitude:longitude, country:country, population:-1};
                geonamesdatabasearray.push(locationdata);
                
                data[index].latitude = latitude;
                data[index].longitude = longitude;
                data[index].geocode = true;
                deferred.resolve();
            } else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
                nogeoarray.push(index);
                alert("Geocode failed: " + status);
                deferred.resolve();
            }else {
                alert("Geocode failed: " + status);
                deferred.resolve();
            }
        })
    });
}

function updategeonamesarray(){
    $.ajax({
        url: 'update_geonames_database.php',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(geonamesdatabasearray),
        dataType: 'json',
        success: function(msg) {
            alert(msg);
        }
    })
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
    console.table(pathlineArray);
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
    cityToMarkersArray[data.city] = markers.length;

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
                showsubsetoflines(cityToMarkersArray[data.city]);
            }
            

//            panorama.setPosition(location);
//            panorama.setVisible(true);
        });
    textToMarkersArray[data.text] = markers.length;
    idNametoMarkerArray["a" + (textArray.length) ] = markers.length;
    markers.push(marker);
    textArray.push(data.text);
    addLine(location);

}
		
function addExisting(data){
    var index = cityToMarkersArray[data.city];
    var content = markers[index].info.getContent(this);
    var location = markers[index].getPosition();
    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>";

    content = content + "<p>" + string +  "</p>";
    
    markers[index].info.setContent(content);
    
    
    textToMarkersArray[data.text] = index;
    idNametoMarkerArray["a" + (textArray.length) ] = index;
    textArray.push(data.text);
    //idNametoMarkerArray["a" + (textArray.length - 1) ] = index;
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
            var stringreplace = '<a id="a' + i + '"  class="jumpanchor" style="background-color:yellow" href="#" onclick="centerOnMarker(this);">' + textArray[i] + "</a>";
            //var stringreplace = '<span id="a' + i + '"  class="jumpanchor" style="background-color:yellow" onclick="centerOnMarker(this);">' + textArray[i] + "</span>";
            
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
    
//    var index = textToMarkersArray[pass.text];
    var index = textToMarkersArray[pass.innerHTML];
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
    
    for(i = index - 1; (i < index + 3) && (i < pathlineArray.length - 1); i++){
        if(i<0){
            i=0;
        }
//        else if (i > pathlineArray.length - 1){
//            i = pathlineArray.length - 1;
//        }
            
        pathlineArray[i].setMap(map);     
    }
    
    
}

function removemarkers(){
    for(i in markers){
        markers[i].setMap(null);
    }
}

function restoremarkers(){
     for(i in markers){
        markers[i].setMap(map);
    }
}


function setmarkervisible(pass){
    var index = idNametoMarkerArray[pass.id];
    if(index == undefined){
        console.log("on undefined id:" + pass.id)
    }else{
        markers[index].setMap(map);
        pathlineArray[pass.id.slice(1)].setMap(map);
    }
}

function setmarkerinvisible(pass){
    var index = idNametoMarkerArray[pass.id];
   if(index == undefined){
        console.log("off undefined id:" + pass.id)
    }else{
        markers[index].setMap(null);
        pathlineArray[pass.id.slice(1)].setMap(null);
    }
}


function isScrolledIntoView(elem) {
    if ($(elem).length == 0) {
        return false;
    }
    var docViewTop = $('#inputtext').scrollTop();
    var docViewBottom = docViewTop + $('#inputtext').height();

    var elemTop = $(elem).offset().top;
    //var elemTop = $(elem).getBoundingClientRect().top
    var elemBottom = elemTop + $(elem).height();
        
    //return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop)); 
    return (docViewBottom >= elemTop && docViewTop <= elemBottom);
}

//function isScrolledIntoView(ele) {
// 
//    
//    var lBound =  $('#inputtext').scrollTop(),
//        uBound = lBound +  $('#inputtext').height(),
//        top = $(ele).offset().top,
//        bottom = top + $(ele).outerHeight(true);
//
//    return (top > lBound && top < uBound)
//        || (bottom > lBound && bottom < uBound)
//        || (lBound >= top && lBound <= bottom)
//        || (uBound >= top && uBound <= bottom);
//}


jQuery(function($) {
    $('#scrollfiltercheckbox').click(function () {


        if ($('#scrollfiltercheckbox').prop('checked')) {
            scrollfilterflag = true;
        } else {
            scrollfilterflag = false;
            showline();
            restoremarkers();
        }
    });
    
    $('#showsubsetcheckbox').click(function () {


        if ($('#showsubsetcheckbox').prop('checked')) {
            showsubsetoflines(clickindex);
        } else {
            showline();
        }
    });
    
    $('#showmarkerscheckbox').click(function () {


        if ($('#showmarkerscheckbox').prop('checked')) {
            restoremarkers();
        } else {
            removemarkers();
        }
    });
    
    $('#showlinescheckbox').click(function () {


        if ($('#showlinescheckbox').prop('checked')) {
            showline();
        } else {
            removeline();
        }
    });
    
    $('#content').bind('scroll', function() {
        $('.jumpanchor').each(function () {
            if(scrollfilterflag == true){
                if(isScrolledIntoView(this)){
                    setmarkervisible(this);
                }
                else{
                    setmarkerinvisible(this);
                }
            }
        });
    })
});	

google.maps.event.addDomListener(window, 'load', initialise);

//$(document).on("click", function(e){
//   
//    //$(this).remove();
//    
//    //e.preventDefault();
//    // IGNORE BROWSER, DO MY OWN THING
//    
//    
//    //CLICK HANDLER
//    if ($('#scrollfiltercheckbox').prop('checked')) {
//            scrollfilterflag = true;
//    } else {
//        scrollfilterflag = false;
//        showline();
//        restoremarkers();
//    }
//    
//});