import './leaflet-list-markers.css';

(function() {

    L.Control.ListMarkers = L.Control.extend({
    
        includes: L.version[0]==='1' ? L.Evented.prototype : L.Mixin.Events,
    
        options: {		
            layer: false,
            collapsed: true,		
            label: 'title',
            // itemIcon: L.Icon.Default.imagePath+'/marker-icon.png',
            itemArrow: '&#10148;',	//visit: http://character-code.com/arrows-html-codes.php
            maxZoom: 9,
            position: 'bottomright'
            //TODO autocollapse
        },
    
        initialize: function(options) {
            L.Util.setOptions(this, options);
            this._container = null;
            this._list = null;
            this._layer = this.options.layer || new L.LayerGroup();
        },
    
        onAdd: function (map) {
    
            this._map = map;
        
            var container = this._container = L.DomUtil.create('div', 'list-markers');
            this._container.addEventListener('wheel', function(event) {
                // 阻止事件冒泡
                event.stopPropagation();
            }, { passive: false }); 
    
            this._list = L.DomUtil.create('ul', 'list-markers-ul', container);
    
            map.on('moveend', this._updateList, this);
                
            this._updateList();
    
            return container;
        },
        
        onRemove: function(map) {
            map.off('moveend', this._updateList, this);
            this._container = null;
            this._list = null;		
        },
    
        _createItem: function(layer) {
            var li = L.DomUtil.create('li', 'list-markers-li'),
                a = L.DomUtil.create('a', '', li),
                // icon = this.options.itemIcon ? '<img src="'+this.options.itemIcon+'" />' : '',
                that = this;
    
            a.href = '#';
            L.DomEvent
                .disableClickPropagation(a)
                .on(a, 'click', L.DomEvent.stop, this)
                .on(a, 'click', function(e) {
                    this._moveTo( layer.getLatLng() );
                    this.fire('item-click', {layer: layer });
                }, this)
                .on(a, 'mouseover', function(e) {
                    that.fire('item-mouseover', {layer: layer });
                }, this)
                .on(a, 'mouseout', function(e) {
                    that.fire('item-mouseout', {layer: layer });
                }, this);			
    
            a.innerHTML = '<span>'+layer.feature.properties.name_zh+'</span> <b>'+this.options.itemArrow+'</b>';
            return li;
        },
    
        _updateList: function() {
        
            var that = this;
    
            this._list.innerHTML = '';
            this._layer.eachLayer(function(layer) {
                if( that._map.getBounds().contains(layer.getLatLng()) )
                    that._list.appendChild( that._createItem(layer) );
            });
        },
    
        _initToggle: function () {
    
            /* inspired by L.Control.Layers */
    
            var container = this._container;
    
            //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
            container.setAttribute('aria-haspopup', true);
    
            if (!L.Browser.touch) {
                L.DomEvent
                    .disableClickPropagation(container);
                    //.disableScrollPropagation(container);
            } else {
                L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
            }
        },
    
        _moveTo: function(latlng) {
            if(this.options.maxZoom)
                this._map.setView(latlng, Math.max(this._map.getZoom(), this.options.maxZoom) );
            else
                this._map.panTo(latlng);    
        }
    });
    
    L.control.listMarkers = function (options) {
        return new L.Control.ListMarkers(options);
    };
    
    L.Map.addInitHook(function () {
        if (this.options.listMarkersControl) {
            this.listMarkersControl = L.control.listMarkers(this.options.listMarkersControl);
            this.addControl(this.listMarkersControl);
        }
    });
    
    }).call(this);