import './graticule.js'
import './fishery_area.js'
import './ship.js'
import './leaflet-list-markers.js'
import './info.css'

const map = L.map('map').setView([29, 125], 6);
// const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     maxZoom: 19,
//     attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
// }).addTo(map)

const tmsLayer = L.tileLayer('/tms/{z}/{x}/{y}.png', {
    tms: true,
    maxZoom: 12,
}).addTo(map);

L.latlngGraticule({
    showLabel: true,
    zoomInterval: [
        {start: 2, end: 3, interval: 30},
        {start: 4, end: 4, interval: 10},
        {start: 5, end: 7, interval: 5},
        {start: 8, end: 10, interval: 1}
    ]
}).addTo(map);

const fisheryArea = L.fisheryArea({
    onEachFeature: function(feature, layer) {
        layer.on({
            mouseover: function(e) {
                if (map.getZoom() < 10) {
                    e.target.setStyle({
                        // color: 'grey',  // change color to blue
                        weight: 3,  // increase weight
                        fillOpacity: 0.5,
                        dashArray: '',
                    });
                }
            },
            mouseout: function(e) {
                fisheryArea.resetStyle(e.target)
            },
            click: function(e) {
                map.fitBounds(e.target.getBounds(), {maxZoom: Math.max(map.getZoom(), 11)});
            }
        });

        // Bind a tooltip to the layer and show the area information
        layer.bindTooltip(function() {
            return '海区：' + feature.properties.area;
        });
    }
}).addTo(map);

const info = L.control();
info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this.update();
    return this._div;
};
info.update = function (props) {
    this._div.innerHTML = '<h4>渔船信息</h4>' + ( props ?
        getInfoData(props)
        : '点击渔船查看详细信息'
    )
}
info.addTo(map);

function getInfoData(props) {
    // 将props.updatetimestamp转换为MM-DD HH:mm格式
    const date = new Date(props.updatetimestamp * 1000);
    const formattedDate = date.toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'});
    // 计算相对时间，例如“刚刚”、“1分钟前”、“2小时前”等
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const relativeTime = minutes < 1 ? '刚刚' : hours < 1 ? minutes + '分钟前' : hours + '小时前';
    return '船名：' + props.name_zh + '<br>海区：' + props.area + '<br>经度：' + props.longitude + '<br>纬度：' + props.latitude + '<br>更新时间：' + formattedDate + '<br>相对时间：' + relativeTime
}

let shiplayers;
let list;
let clickedLayer;

function clickLayer(layer) {
    if (clickedLayer) {
        shiplayers.resetStyle(clickedLayer)
    }
    layer.setStyle({
        fillColor: '#b200ff',
    })
    clickedLayer = layer;
}

function fetchLatest(timestamp) {
    const url = timestamp ? '/api/latest?before=' + timestamp : '/api/latest';
    // shipLayers.clearLayers();
    fetch(url)
        .then(response => response.json())
        .then(ships => {
            // If shiplayers layer already exists, remove it from the map
            if (shiplayers) {
                shiplayers.remove();
            }
            shiplayers = L.ship(ships, {
                onEachFeature: function(feature, layer) {
                    layer.on({
                        click: function(e) {
                            map.setView(e.latlng, Math.max(map.getZoom(), 12));
                            info.update(feature.properties);
                            clickLayer(e.target);
                        },
                        mouseover: function(e) {
                            e.target.setStyle({
                                weight: 3,
                            })
                            e.target.bringToFront();
                        },
                        mouseout: function(e) {
                            e.target.setStyle({
                                weight: 1,
                            });
                        }
                    })
                    layer.bindTooltip(function() {
                        return getInfoData(feature.properties);
                    })
                }
            }).addTo(map);

            if (list) {
                map.removeControl(list);
            }
            list = new L.Control.ListMarkers({layer: shiplayers, itemIcon: null});
            list.on('item-mouseover', function(e) {
                e.layer.setStyle({
                    weight: 3,
                });
                e.layer.bringToFront();
            })
            list.on('item-mouseout', function(e) {
                e.layer.setStyle({
                    weight: 1, 
                });
            })
            list.on('item-click', function(e) {
                e.layer.setStyle({
                    weight: 1,
                });
                map.setView(e.layer.getLatLng(), Math.max(map.getZoom(), 12));
                info.update(e.layer.feature.properties);
                clickLayer(e.layer);
            })
            map.addControl(list);
        });
}
fetchLatest()

document.getElementById('dateInput').valueAsDate = new Date();
document.getElementById('dateInput').addEventListener('change', function() {
    const dateInput = new Date(this.value);
    dateInput.setDate(dateInput.getDate() + 1); // move to next day
    dateInput.setHours(0, 0, 0, 0); // set time to 0:0:0:0
    const timestamp = dateInput.getTime() / 1000; // convert to timestamp
    fetchLatest(timestamp);
});
  
function fetchNew() {
    return fetch('/api/new')
        .then(response => response.json())
}
document.getElementById('updateButton').addEventListener('click', function() {
    var button = document.getElementById('updateButton');
    button.innerText = '更新中...';
    button.disabled = true;

    fetchNew()
        .then(() => {
            document.getElementById('dateInput').valueAsDate = new Date();
            dateInput.dispatchEvent(new Event('change'));
        })
        .finally(function() {
            button.innerText = '更新数据';
            button.disabled = false;
        });
});