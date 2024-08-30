const area = require('@/data/area.json');
const infoElement = document.getElementById("info");

const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
const tenDaysAgoBejing = new Date(tenDaysAgo.getTime() + 8 * 60 * 60 * 1000);
const dateInput = document.getElementById('date-input');
dateInput.value = tenDaysAgoBejing.toISOString().slice(0, 19);
const dateInputRoute = document.getElementById('date-input-route');
dateInputRoute.value = tenDaysAgoBejing.toISOString().slice(0, 19);

const shipInput = document.getElementById('ship-input');
const datalist = document.getElementById('ship-list');
fetchShips();

shipInput.addEventListener('input', (event) =>  {
  event.preventDefault();
  event.stopPropagation();
  fetchShips(event.target.value);
});

shipInput.addEventListener('change', function() {
  const selectedOption = Array.from(datalist.options).find(option => option.value === this.value);
  if (selectedOption && dateInputRoute.value) {
    fetchRoute(selectedOption.textContent, dateInputRoute.value);
  }
});

dateInputRoute.addEventListener('change', function() {
  const selectedOption = Array.from(datalist.options).find(option => option.value === shipInput.value);
  if (selectedOption && this.value) {
    fetchRoute(selectedOption.textContent, this.value);
  }
})

// Fetch ships data and build the list
dateInput.addEventListener('change', function() {
  const selectedDate = new Date(this.value);
  const timestamp = selectedDate.getTime();
  fetchLatest(timestamp);
});

const map = new AMap.Map("container", {
  center: [125, 31],
  // zoom: 5, //级别
});

// 创建一个经纬度边界
const bounds = new AMap.Bounds(
    [115, 20.5], // 西南角
    [135, 42]  // 东北角
);

// 将地图的视图设置为这个边界
map.setBounds(bounds);

// 设置边界
const southWest = bounds.getSouthWest();
const northEast = bounds.getNorthEast();

drawLines()
drawAreas()

fetchLatest(tenDaysAgo.getTime());

function createListItem(ship, marker, listContainer) {
  var listItem = document.createElement('div');
  listItem.classList.add('ship-list-item');
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = ship.name_en;
  checkbox.checked = true;
  checkbox.addEventListener('change', (event) => {
    if (event.target.checked) {
      marker.show()
    } else {
      marker.hide();
    }
  });
  var label = document.createElement('label');
  label.textContent = ship.name_zh;
  listItem.appendChild(checkbox);
  listItem.appendChild(label);
  listContainer.appendChild(listItem);
}

const markers = [];
let polyline = null;

function fetchLatest(timestamp) {
  fetch('/api/latest?after=' + timestamp)
    .then(response => response.json())
    .then(ships => {
      const listContainer = document.getElementById('ship-list-container');
      // Clear the list
      listContainer.innerHTML = '';
      map.remove(markers);
      if (polyline) map.remove(polyline);
      ships.forEach(ship => {
        const marker = new AMap.Marker({
          position: [ship.longitude, ship.latitude],
          title: `中文船名: ${ship.name_zh}\n英文船名: ${ship.name_en}\n经纬度: [${ship.longitude}, ${ship.latitude}]\n渔区: ${ship.area}\n更新时间: ${ship.staticinfoupdatetime}`,
        });
        map.add(marker);
        markers.push(marker);
        marker.on('mouseover', function(e) {
          infoElement.innerHTML = `中文船名: ${ship.name_zh}<br/>英文船名: ${ship.name_en}<br/>经纬度: [${ship.longitude}, ${ship.latitude}]<br/>渔区: ${ship.area}<br/>更新时间: ${ship.staticinfoupdatetime}`;
          infoElement.style.display = "block";
        });
        marker.on('mouseout', function(e) {
          infoElement.innerHTML = "";
          infoElement.style.display = "none";
        });
        createListItem(ship, marker, listContainer);
      });
      map.setFitView(markers)
    });
}

function fetchRoute(shipName, datetime) {
  const selectedDate = new Date(datetime);
  const timestamp = selectedDate.getTime();
  fetch(`/api/ship/${shipName}?after=` + timestamp)
    .then(response => response.json())
    .then(routes => {
      map.remove(markers);
      if (polyline) map.remove(polyline);

      // 创建一个新的路径
      const path = routes.map(route => [route.longitude, route.latitude]);
      polyline = new AMap.Polyline({
        path: path,
        strokeColor: "#FF0000",  // 设置线颜色
        strokeOpacity: 1,        // 设置线透明度
        strokeWeight: 5,         // 设置线宽
        strokeStyle: "solid",    // 设置线样式
        strokeDasharray: [10, 5], // 设置线断续样式
        lineJoin: 'round', // 折线拐点的绘制样式
        lineCap: 'round', // 折线两端线帽的绘制样式
        showDir: true // 显示线的方向
      });

      // 添加标记到每个点上，并设置信息和方向
      routes.forEach(ship => {
        const marker = new AMap.Marker({
          position: [ship.longitude, ship.latitude],
          title: `中文船名: ${ship.name_zh}\n英文船名: ${ship.name_en}\n经纬度: [${ship.longitude}, ${ship.latitude}]\n渔区: ${ship.area}\n更新时间: ${ship.staticinfoupdatetime}`,
          angle: ship.direction // 假设ship.direction是船舶的方向，以度为单位
        });
        map.add(marker);
        markers.push(marker);
        marker.on('mouseover', function(e) {
          infoElement.innerHTML = `中文船名: ${ship.name_zh}<br/>英文船名: ${ship.name_en}<br/>经纬度: [${ship.longitude}, ${ship.latitude}]<br/>渔区: ${ship.area}<br/>更新时间: ${ship.staticinfoupdatetime}`;
          infoElement.style.display = "block";
        });
        marker.on('mouseout', function(e) {
          infoElement.innerHTML = "";
          infoElement.style.display = "none";
        });
      });

      // 将路径添加到地图上
      map.add(polyline);

      // 调整视野以适应新的路径
      map.setFitView([polyline]);
    })
}

function fetchShips(name) {
  let url = '/api/ships';
  if (name) {
    url += `?name=${name}`;
  }
  fetch(url)
    .then(response => response.json())
    .then(data => {
      // 清空datalist
      datalist.innerHTML = '';
      // 为每艘返回的船添加一个新的option
      for (const ship of data) {
        const option = document.createElement('option');
        option.value = ship.name_zh;
        option.textContent = ship.name_en ;
        datalist.appendChild(option);
      }
    });
}

window.changeTab = function(index) {
  var tabs = document.getElementsByClassName("tab-content");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove("active");
  }
  document.getElementById("tab-content-" + index).classList.add("active");
  if (index == 0 && dateInput.value) {
    const selectedDate = new Date(dateInput.value);
    const timestamp = selectedDate.getTime();
    fetchLatest(timestamp)
  } else if (index == 1) {
    const selectedOption = Array.from(datalist.options).find(option => option.value === shipInput.value);
    if (selectedOption && dateInputRoute.value) {
      fetchRoute(selectedOption.textContent, dateInputRoute.value);
    }
  }
};

function drawLines() {
  const lngs = [120, 125, 130];
  const lats = [25, 30, 35, 40];

  lngs.forEach((lng) => {
    new AMap.Polyline({
      path: [[lng, southWest.lat], [lng, northEast.lat]],
      strokeColor: "#0000FF",
      strokeOpacity: 1,
      strokeWeight: 1,
      map: map,
    });

    new AMap.Text({
      position: [lng, northEast.lat],
      text: `经度: ${lng}`,
      style: {
        'background-color': 'transparent',
        'border': 'none',
        'font-size': '15px',
        'color': 'blue'
      },
      map: map
    });
  });

  lats.forEach((lat) => {
    new AMap.Polyline({
      path: [[southWest.lng, lat], [northEast.lng, lat]],
      strokeColor: "#0000FF",
      strokeOpacity: 1,
      strokeWeight: 1,
      map: map,
    });

    new AMap.Text({
      position: [southWest.lng, lat],
      text: `纬度: ${lat}`,
      style: {
        'background-color': 'transparent',
        'border': 'none',
        'font-size': '15px',
        'color': 'blue'
      },
      map: map
    });
  });
}

function drawAreas() {
  for (let lng = southWest.getLng(); lng < northEast.getLng(); lng += 0.5) {
    for (let lat = southWest.getLat(); lat < northEast.getLat(); lat += 0.5) {
      const key = `[${lng}, ${lat}]`;
      if (!area[key]) {
        continue
      }
      const grid = new AMap.Polygon({
        path: [
            [lng, lat],
            [lng + 0.5, lat],
            [lng + 0.5, lat + 0.5],
            [lng, lat + 0.5]
        ],
        strokeColor: "#000000",
        strokeWeight: 0.5,
        fillColor: "#1791fc",
        fillOpacity: 0
      });
      grid.setMap(map);
  
      grid.gridName = area[key];
  
      // 添加鼠标事件
      grid.on('mouseover', function(e) {
        e.target.setOptions({fillColor: "#FF0000", fillOpacity: 0.35});
        infoElement.innerHTML = `渔区：${e.target.gridName}<br/>经度：${lng}-${lng+0.5}<br/>纬度：${lat}-${lat+0.5}`;
        infoElement.style.display = "block";
      });
      grid.on('mouseout', function(e) {
        e.target.setOptions({fillColor: "#1791fc", fillOpacity: 0});
        infoElement.innerHTML = "";
        infoElement.style.display = "none";
      });
    }
  }
}
