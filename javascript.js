/*global google */
/*global alert */
/*global window */
var map;
var geocoder;
var pathlineArray = [];
var markerArray = [];
var textArray = [];
var geonamesdatabasearray = [];
var nogeoarray = [];            //array to hold cities that couldn't be geolocated
var cityToMarkersArray = {};    //convert city name to marker array index
var textToMarkersArray = {};    //convert text name to marker array index
var idNametoMarkerArray = {};   //convert html anchor id to marker array index
var allcitydata;                //hold json data
var lastposition;               //last position for lines
var subsetflag = false;         //flag for subset of lines
var clickindex=0;               //last icon clicked
var panorama;
var directionsService;
var scrollfilterflag = false;   //flag for handling text scroll filtering


function initialise() {
    
    //initialise map options
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
    
    getdatafromjson();
    searchformissingcoords();
    
    
}

function getdatafromjson(){
    //get the data that was provided by the java program and geonames backround database.
    $.ajaxSetup( { "async": false } );
    $.getJSON('data1.json', function (data1) {
        allcitydata = data1;
    });	
    $.ajaxSetup( { "async": true } );
    
}


function searchformissingcoords(){
    // search the data array to find locations that are missing coordinate data
    var deferstack = [];
    for (i= 0 ; i < allcitydata.length; i++ ) {
        if (allcitydata[i].geocode === false){ //if the coordinates are missing, use google geocode service to find them
                deferstack.push(geocode(i,allcitydata[i]));
        }  
    }
    
    //continue on with program only after all the outside http requests have finished
    // uses a stack as a counter, continue when stack is empty
    $.when.apply($, deferstack).done(function() {
                moreAddresses();
                //updategeonamesarray();
            console.table(allcitydata);
    });
}

function geocode(index, data1){
    // function is used to call the google geocode service and get coordinates for any locations that are missing that data
    geocoder = new google.maps.Geocoder();
    return $.Deferred(function(deferred) {  // use defers as a form of promise
        var url_addr = encodeURIComponent(data1.city);
        $.getJSON('geocode.php?addr='+url_addr, function(reqdata) { // use outside php code to actually make the requests, takes some load off of the javascipt and 
            var results = reqdata.results;                          // transfers it to the backround server
            var status = reqdata.status;
            if (status == google.maps.GeocoderStatus.OK) {          // if the status is ok add data to the backround arrays
                var latitude = results[0].geometry.location.lat;
                var longitude = results[0].geometry.location.lng;
                var country;
                
                //This is used to get the country from the returned geocode request, and is used to update the backround geonames database with new locations
                for (var i=0; i<results[0].address_components.length; i++) {
                    for (var b=0;b<results[0].address_components[i].types.length;b++) {
                        if (results[0].address_components[i].types[b] == "country") {
                            
                            country = results[0].address_components[i].short_name;  
                            break;
                        }
                    }
                }
                
                //default value if no country found                
                if (typeof country == "undefined"){
                    country = "XX";
                }
                
                //create a location object and store it
                var locationdata = {name: data1.city, latitude:latitude, longitude:longitude, country:country, population:-1};
                geonamesdatabasearray.push(locationdata);
                
                allcitydata[index].latitude = latitude;
                allcitydata[index].longitude = longitude;
                allcitydata[index].geocode = true;
                deferred.resolve(); //resolve the promise and remove it from the stack
            } else if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) { // if the query limit is reached (should be fixed now that the server makes the calls
                
                alert("Geocode failed: " + status);
                deferred.resolve();
            }else {
                nogeoarray.push(index);
                alert("Geocode failed: " + status);
                deferred.resolve();
            }
        })
    });
}


function updategeonamesarray(){
    // this is the function that sends data for the backround geonames database on the server to be updated with any info gained from google geocode service
    $.ajax({
        url: 'update_geonames_database.php',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(geonamesdatabasearray),
        dataType: 'json',
        success: function(msg) {
            //alert(msg);
        }
    })
}
	
function moreAddresses() {
// this function runs through the final data arrays and starts to create the markers.
for (var i in allcitydata) {
    if (allcitydata[i].city in cityToMarkersArray){ // if the city has already had a marker made, update it with the new information
        addExisting(allcitydata[i],i);
    }
    else{
        if (allcitydata[i].geocode === false){ //could not find any geocode information for the location
            alert("no geocode for:" + allcitydata[i].city);
        }
        else{ // create a new marker for the city
            var position =  new google.maps.LatLng(allcitydata[i].latitude, allcitydata[i].longitude);   
            addMarker(allcitydata[i],position);
        }

    }
}
    convertToHtml(); //after all the markers have been made, create the text formatting and links for the text explorer
    //createLines();
    console.table(textArray);
    //console.table(idNametoMarkerArray);
}
    

		
function addMarker(data, location){
    // this function is used to create new markers for a location or city.
    
    //create the marker
    var marker = new google.maps.Marker({
        map: map, 
        position: location,
        title: data.city
    });	
    
    marker.setIcon('http://maps.google.com/mapfiles/marker.png');
    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>"; // set anchor tags around the sentence containing the location name so it can be linked
                                                                                // to the text explorer
    // create the infowindow when a marker is clicked containing the location name and text data
    marker.info = new google.maps.InfoWindow({
          content: "<h3>"+ data.city + "</h3>" + string
        });
    cityToMarkersArray[data.city] = markerArray.length; // map the city name to the marker array index 

    // listener for the marker click function
    google.maps.event.addListener(marker, 'click', function() {
            //set all the other markers to default icon
            for(i in markerArray){
                markerArray[i].setIcon('http://maps.google.com/mapfiles/marker.png');
            }
            marker.setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png'); //change the clicked marker to green
            clickindex = cityToMarkersArray[data.city]; //update click index to keep track of the last clicked marker
            //close all the other infowindows
            for(i in markerArray){
                markerArray[i].info.close();
            }
            marker.info.open(map, marker); // open this infowindow
            if (subsetflag == true) //send the location data to the subset function
            {
                showsubsetoflines(cityToMarkersArray[data.city]);
            }
            

//            panorama.setPosition(location);
//            panorama.setVisible(true);
        });
    textToMarkersArray[data.text] = markerArray.length; //map the sentence text to the marker array index number
    idNametoMarkerArray["a" + (textArray.length) ] = markerArray.length; //map the html anchor id name to the marker array index number
    markerArray.push(marker); //add to markerArray array
    textArray.push(data.text); //add to text array
    addLine(location); //create line on map

}
		
function addExisting(data){
    //this function is used to update existing markers at a location with some more sentences
    var index = cityToMarkersArray[data.city]; //get marker array index for the city
    var content = markerArray[index].info.getContent(this); //get existing content
    var location = markerArray[index].getPosition(); //get existing location
    var string = '<a href="#a' + textArray.length + '">' + data.text +  "</a>"; //create a new anchor for the new text sentence

    content = content + "<p>" + string +  "</p>";
    
    markerArray[index].info.setContent(content);
    
    
    textToMarkersArray[data.text] = index; // map sentence to marker array index number
    idNametoMarkerArray["a" + (textArray.length) ] = index; //map id name to marker array index number
    textArray.push(data.text);
    addLine(location);
}
		
function addLine (position){
    var pathLatLng = [];
    //need a beggining and end to line, if its the first location use it for both
    if (markerArray.length == 1){
        lastposition = position;
    }
    pathLatLng.push(lastposition);
    pathLatLng.push(position);
    
    //choose the type of line or arrow
    var lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
    };
    
    //choose some attributes for the line like colour and weight
    var pathline = new google.maps.Polyline({
        path: pathLatLng,
        geodesic: true, // change from curved lines to straight lines
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
    //function is used to create the highlighting and links in the text explorer
    jQuery.get('sample.txt', function(noveltext) { // load the data
    var string = noveltext;
    for (var i in textArray){
            //create the html tag with the anchor id and the onclick function
            var stringreplace = '<a id="a' + i + '"  class="jumpanchor" style="background-color:yellow" href="#" onclick="centerOnMarker(this);">' + textArray[i] + "</a>";
            
            // ignore any whitespace formatting when searching for the sentence
            var num = textArray[i].split(' ');
            var t = num[0];
            for(i = 1; i < num.length; i++){
                t += "([\\s]*)" + num[i];
            }
            var regex = new RegExp(t);
            noveltext = noveltext.replace(regex, stringreplace); //replace the old text with the new one with html tags
            
        }
        document.getElementById("inputtext").innerHTML = noveltext; //update the html dom element with the new formatted text
    });
}



function centerOnMarker(pass){
    //this function is used to centre the map on the related marker when a sentence is clicked in the text explorer
    var index = textToMarkersArray[pass.innerHTML]; //get the marker index using the text sentence
    p = pass.id;
    var idnum = p.slice(1); //get the id number "a12" -> "12"
    markerArray[index].setIcon('http://maps.google.com/mapfiles/ms/icons/green-dot.png'); //set the current marker to green
    markerArray[clickindex].setIcon('http://maps.google.com/mapfiles/marker.png'); //set the old one to standard
    //close the rest of the infowindows
    for(i in markerArray){
                markerArray[i].info.close();
    }
    markerArray[index].info.open(map, markerArray[index]); //open the relevant infowindow
    //center the mao
    var LatLng  = markerArray[index].getPosition();
    map.setCenter(LatLng);
    map.setZoom(6);
    clickindex = index;
    if (subsetflag == true)
    {
        showsubsetoflines(parseInt(idnum));
        
    }
}

function removeline(){
    //loop through and set the lines to invisible
    for(i in pathlineArray){
        pathlineArray[i].setMap(null);
    }
}

function showline(){
    // loop through and set the lines to visible
    subsetflag = false;
    for(i in pathlineArray){
        pathlineArray[i].setMap(map);
    }
}


function showsubsetoflines(index){
    // show a subset of the lines, two ahead and two behind the current marker
    subsetflag = true;
    removeline();
    
    for(i = index - 1; (i < index + 3) && (i < pathlineArray.length - 1); i++){
        if(i<0){
            i=0;
        }
            
        pathlineArray[i].setMap(map);     
    }
    
    
}

function removemarkers(){
    // loop through and set  all the markers to invisible
    for(i in markerArray){
        markerArray[i].setMap(null);
    }
}

function restoremarkers(){
    // loop through and set the markers to visible
     for(i in markerArray){
        markerArray[i].setMap(map);
    }
}


function setmarkervisible(pass){
    // set an individual marker to visible, used for the scroll filter function
    var index = idNametoMarkerArray[pass.id];
    if(index == undefined){
        console.log("on undefined id:" + pass.id)
    }else{
        markerArray[index].setMap(map);
        pathlineArray[pass.id.slice(1)].setMap(map);
    }
}

function setmarkerinvisible(pass){
    // set an individual marker to invisible, used for the scroll filter function
    var index = idNametoMarkerArray[pass.id];
   if(index == undefined){
        console.log("off undefined id:" + pass.id)
    }else{
        markerArray[index].setMap(null);
        pathlineArray[pass.id.slice(1)].setMap(null);
    }
}


function isScrolledIntoView(elem) {
    // function to compute when a sentence is visible in the text explorer, used to filter the amount of lines and markers based on whats visible
    if ($(elem).length == 0) {
        return false;
    }
    var docViewTop = $('#inputtext').scrollTop();
    var docViewBottom = docViewTop + $('#inputtext').height();

    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();
         
    return (docViewBottom >= elemTop && docViewTop <= elemBottom);
}



jQuery(function($) {
    
    // thes functions control the checkboxes function at the top of the visualisation
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
    
    // scroll view function
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

