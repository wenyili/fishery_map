const area = require('@/data/area.json');

L.FisheryArea = L.GeoJSON.extend({
    options: {
        style: {
            color: 'grey',
            weight: 1,
            fillOpacity: 0,
            dashArray: '3',
        },
        bounds: {
            north: 42,
            south: 20.5,
            east: 135,
            west: 115
        }
    },
    initialize: function (options) {
        L.Util.setOptions(this, options);
        this._layers = {};
        this.addData(this.__getData());
    },
    __getData: function () {
        const features = [];

        for (let lat = this.options.bounds.south; lat < this.options.bounds.north; lat += 0.5) {
            for (let lng = this.options.bounds.west; lng < this.options.bounds.east; lng += 0.5) {
                const key = `[${lng}, ${lat}]`;
                if (!area[key]) {
                    continue
                }
                const polygonFeature = {
                    "type": "Feature",
                    "properties": {
                        "area": area[key]
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [lng, lat],
                                [lng, lat + 0.5],
                                [lng + 0.5, lat + 0.5],
                                [lng + 0.5, lat],
                                [lng, lat]
                            ]
                        ]
                    }
                };
                features.push(polygonFeature);
            }
        }

        return {
            "type": "FeatureCollection",
            "features": features
        }
    }
})

L.fisheryArea = function (options) {
    return  new L.FisheryArea({
        ...options,
        style: {
            color: 'grey', 
            weight: 1,
            fillOpacity: 0,
            dashArray: '3',
        }
    });
};