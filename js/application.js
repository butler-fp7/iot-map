var iotMap = (function() {
    return {
        devices: [], // holds the list of devices once loaded
        map: null,
        iconStyles: [], // holds style for icons. Only the image differs (numbered marker)
        vectorSource: null,
        vectorLayer: null,
        geoServerURL: 'http://localizationmanager.ismb.iot-butler.eu:8081/geoserver/wms?',
        devicesURL: "http://localizationmanager.ismb.iot-butler.eu/api/v1/associations",
        initialCenter: [-3.766161111111111, 43.469063888888890],
        initialZoomLevel: 18,
        locations: [{"name": "Palacio de la Magdalena", "lat": -3.766161111111111, "lng": 43.469063888888890},
                    {"name": "Tecnalia", "lat": -2.860733239072649, "lng": 43.29266368398545},
                    {"name": "ISMB", "lat": 7.65905604971683, "lng": 45.065617698525}],
        refreshInterval: 5, // in seconds
        refreshTimer: null, // hold the setTimeout instance
        // load devices and store them in the devices array
        loadDevices: function(){
            $.getJSON(this.devicesURL, 
                          function(data){
                            iotMap.devices = data;
                            // create template functions
                            var devicesTemplate = _.template($('#devices-data').html());
                            var locationsTemplate = _.template($('#locations-data').html());
                            // render templates with the given data
                            $("#devices").html(devicesTemplate({items: data}));
                            $("#locations").html(locationsTemplate({items: iotMap.locations}));
                            iotMap.getDevicesLocation();            
                            // hanlders are set here instead of the regular document ready block since
                            // devices elements are added after the DOM is ready
                            iotMap.setHandlers();
                            iotMap.hideLoader();
                          });
        },
        getDevicesLocation: function(){
            $.each(iotMap.devices, function(index, value) {
                $Bl.getLocalization(value.asID, "abs", "last", function(data) {
                    iotMap.displayDeviceLocationAndSaveCoordinates(data, index);
                });
            });
        },
        // update the UI and save devices location in the devices array
        displayDeviceLocationAndSaveCoordinates: function(data, index) {
            deviceId = data.smartObjectId;
            $("#device-" + deviceId + " .location .lat").html(data.latitude);
            $("#device-" + deviceId + " .location .lng").html(data.longitude);
            $("#device-" + deviceId + " .location .height").html(data.height);
            $("#device-" + deviceId + " .location .time-pos-est").html(data.timePosEst);
            // add geolocalization data to the related device object
            iotMap.devices[index].geo = data;
            iotMap.drawMarker(index);
        },
        center: function(lat, lng) {
            // todo: check why coordinates need to be switched!! error somewhere else...
            iotMap.map.getView().setCenter(ol.proj.transform([lng, lat], 'EPSG:4326', 'EPSG:3857'));
        },
        drawMarker: function(index) {
            device = iotMap.devices[index];
            // create an icon feature per device and set the style with a numbered marker
            var iconFeature = new ol.Feature({
                        geometry: new ol.geom.Point(ol.proj.transform([device.geo.longitude, device.geo.latitude], 'EPSG:4326', 'EPSG:3857')),
                        name: 'Device # ' + index+1,
                    });
            iconFeature.setStyle(iotMap.iconStyles[index+1]);
            iotMap.vectorSource.addFeature(iconFeature);
        },
        removeFeatures: function() {
            $.each(iotMap.vectorSource.getFeatures(), function(index, feature) {
                iotMap.vectorSource.removeFeature(feature);
            });
        },
        reloadDevices: function() {
            iotMap.removeFeatures();
            iotMap.showLoader();
            iotMap.devices = [];
            iotMap.loadDevices();
        },
        startAutoRefresh: function() {
            iotMap.refreshTimer = setInterval(function() {
                iotMap.reloadDevices();
            }, iotMap.refreshInterval*1000);
            iotMap.setRefreshCookie(true);
        },
        stopAutoRefresh: function() {
            clearTimeout(iotMap.refreshTimer);
            iotMap.setRefreshCookie(false);
        },
        setRefreshCookie: function(status) {
            // sets a cookie that will hold the auto-refresh mode
            var date = new Date();
            date.setTime(date.getTime()+(24*60*60*1000));
            var expires = "expires="+date.toGMTString();
            document.cookie = "auto-refresh=" + status + "; " + expires + "; path=/";
        },
        checkRefreshCookie: function() {
            var cookies = document.cookie.split(';');
            for(var i=0;i < cookies.length;i++) {
                var c = cookies[i];
                while (c.charAt(0)==' ') c = c.substring(1,c.length);
                if (c.indexOf("auto-refresh=true") == 0) {
                    $(".auto-refresh-devices").addClass("btn-success");
                    iotMap.startAutoRefresh();
                    return true;
                };
            }
            return false;
        },
        setHandlers: function() {
            $(".center").on("click", function() {
                // note: for that we could also hold coordinates in the devices array
                lat = $(this).parent().find(".details .lat").html();
                lng = $(this).parent().find(".details .lng").html();
                iotMap.center(parseFloat(lat), parseFloat(lng));
            });
            $(".refresh-devices").off().click(function() {
                iotMap.reloadDevices();
            });
            $(".auto-refresh-devices").click(function() {
                element = $(this);
                element.toggleClass("btn-success");
                element.hasClass("btn-success") ? iotMap.startAutoRefresh() : iotMap.stopAutoRefresh();
            });
            $(window).resize(function(){
                iotMap.resizeDevivesArea();
            });
            $(".location").click(function(e) {
                e.preventDefault();
                newCenter = iotMap.locations[parseInt($(this).data("location"))];
                iotMap.center(newCenter.lng, newCenter.lat);
            });
        },
        buildMap: function() {
            // setup the array of styles -- supports a maximum of 100 devices
            for (i = 0; i < 100; i++) {
                var iconStyle = new ol.style.Style({
                  image: new ol.style.Icon({
                    anchor: [0.5, 46],
                    anchorXUnits: 'fraction',
                    anchorYUnits: 'pixels',
                    opacity: 0.9,
                    src: '/images/markers/number_' + i + '.png'
                  })
                });
                iotMap.iconStyles.push(iconStyle);

            }       

            // the vector layer holds markers
            iotMap.vectorSource = new ol.source.Vector({})
            iotMap.vectorLayer = new ol.layer.Vector({
                         source: iotMap.vectorSource,
                         style: iotMap.iconStyle
                    });

            iotMap.map = new ol.Map({
                target: 'map',
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.MapQuest({layer: 'osm'})
                        }),
                    new ol.layer.Image({                    
                        source: new ol.source.ImageWMS({
                                url: this.geoServerURL,
                                // params:{'LAYERS':'butler:georef_perlabs_def'},
                                params:{'LAYERS':'planos:planos'},
                                serverType: 'geoserver'
                        })
                    }),
                     iotMap.vectorLayer
                ],
                view: new ol.View({
                    center: ol.proj.transform(this.initialCenter, 'EPSG:4326', 'EPSG:3857'),
                  zoom: 18
                })
            });
            iotMap.map.getView().setZoom(iotMap.initialZoomLevel);
        },
        resizeDevivesArea: function() {
            $("#devices").css("height", "" + parseInt($("#map").css("height")) - 55 + "px");
        },
        showLoader: function() {
            $("#loader").show();
        },
        hideLoader: function() {
            $("#loader").hide();
        }
    }
})();

$(document).ready(function() {

    iotMap.showLoader();
    iotMap.buildMap();
    iotMap.loadDevices();
    iotMap.checkRefreshCookie();
    // resize the devices box to same the same height that the map
    iotMap.resizeDevivesArea();
});

