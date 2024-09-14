const area = require('@/data/area.json');

L.Ship = L.GeoJSON.extend({
    options: {
    },
    initialize: function (data, options) {
        L.Util.setOptions(this, options);
        this._layers = {};
        this.addData(this.__setData(data));
    },
    __setData: function (data) {
        const features = [];
        data.forEach(ship => {
            features.push({
                "type": "Feature",
                "properties": {
                    "name_en": ship.name_en,
                    "name_zh": ship.name_zh,
                    "longitude": ship.longitude,
                    "latitude": ship.latitude,
                    "area": ship.area,
                    "updatetimestamp": ship.updatetimestamp,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [ship.longitude, ship.latitude]
                }
            })
        });

        return {
            "type": "FeatureCollection",
            "features": features
        }
    }
})

var geojsonMarkerOptions = {
    radius: 8,
    fillColor: "#ff7800",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

L.ship = function (data, options) {
    return  new L.Ship(data, {
        ...options,
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, geojsonMarkerOptions);
        }
    });
};