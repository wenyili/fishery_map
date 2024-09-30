import './leaflet-list-markers.css';

(function() {

    L.Control.ListMarkers = L.Control.extend({
    
        includes: L.version[0]==='1' ? L.Evented.prototype : L.Mixin.Events,
    
        options: {		
            layer: false,
            collapsed: true,		
            label: 'title',
            itemArrow: '&#10148;',	//visit: http://character-code.com/arrows-html-codes.php
            position: 'bottomright'
        },
    
        initialize: function(options) {
            L.Util.setOptions(this, options);
            this._container = null;
            this._list = null;
            console.log(this.options.layer)
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
                that = this;
    
            a.href = '#';
            L.DomEvent
                .disableClickPropagation(a)
                .on(a, 'click', L.DomEvent.stop, this)
                .on(a, 'click', function(e) {
                    this.fire('item-click', {layer: layer });
                }, this)
                .on(a, 'mouseover', function(e) {
                    that.fire('item-mouseover', {layer: layer });
                }, this)
                .on(a, 'mouseout', function(e) {
                    that.fire('item-mouseout', {layer: layer });
                }, this);			
                

            // Check if layer is within bounds
            if (that._map.getBounds().contains(layer.getLatLng())) {
                a.style.color = "red"; // Change color to red if layer is within bounds
            }
            
            a.innerHTML = '<span>'+layer.feature.properties.name_zh+'</span> <b>'+this.options.itemArrow+'</b>';
            return li;
        },
    
        _updateList: function() {
        
            var that = this;
    
            this._list.innerHTML = '';
            this._layer.eachLayer(function(layer) {
                that._list.appendChild( that._createItem(layer) );
                // if( that._map.getBounds().contains(layer.getLatLng()) )
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