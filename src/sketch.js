let o_point = [4.9202409051856595, 45.725975684822366];
let v_point = [4.929023131057543, 45.72367082873087];
let b_point = [4.924762893150509, 45.71147464744061];
let a_point = [4.951393097711732, 45.71265438584955];

let points = [o_point, v_point, b_point, a_point];
let map;
let markers = [];
let polylines = null; // Replace polyline with polylines object
let markerStyles = [
  { color: '#f44336', label: 'O', icon: 'home' },
  { color: '#2196F3', label: 'V', icon: 'info' },
  { color: '#4CAF50', label: 'B', icon: 'bridge' },
  { color: '#9C27B0', label: 'A', icon: 'flag' }
];

// Add at the top with other global variables
let multiplier = 1;

function setup() {
  noCanvas();
  
  map = L.map('map').setView([45.72, 4.92], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Add draggable markers for each point
  points.forEach((point, index) => {
    const style = markerStyles[index];
    const marker = L.marker([point[1], point[0]], {
      draggable: true,
      title: style.label,
      icon: L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${style.color}; color: white; padding: 5px; border-radius: 50%; width: 20px; height: 20px; text-align: center; font-weight: bold;">${style.label}</div>`,
      })
    })
      .bindPopup(style.label)
      .addTo(map);

    // Handle marker drag events
    marker.on('dragend', async function(e) {
      const position = e.target.getLatLng();
      points[index] = [position.lng, position.lat];
      await updateRoutes();
    });

    marker.on('drag', async function(e) {
      const position = e.target.getLatLng();
      points[index] = [position.lng, position.lat];
      updateRoutes();
    });

    markers.push(marker);
  });

  // Create initial polyline
   
}

async function updateRoutes() {
  try {
    const baseUrl = 'http://graphhopper.ecov.io';
    const [o, v, b, a] = points;
    const routePairs = [
      // OVBA path
      [o, a],
      [a, v],
      [v, b],
      // OBAB path
      [o, v],
      [v, a],
      [a, b]
    ];

    let ovbaRoute = [];
    let obabRoute = [];
    let ovbaDistance = 0;
    let obabDistance = 0;

    const routes = await Promise.all(routePairs.map(async ([start, end]) => {
      const response = await fetch(
        `${baseUrl}/route?points_encoded=false&point=${start[1]},${start[0]}&point=${end[1]},${end[0]}&vehicle=car`
      );
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      return {
        coordinates: data.paths[0].points.coordinates,
        distance: data.paths[0].distance
      };
    }));

    // Calculate total distances
    ovbaDistance = routes.slice(0, 3).reduce((sum, r) => sum + r.distance, 0);
    obabDistance = routes.slice(3).reduce((sum, r) => sum + r.distance, 0);

    // Separate routes into OVBA and OBAB paths
    ovbaRoute = routes.slice(0, 3).map(r => r.coordinates).flat();
    obabRoute = routes.slice(3).map(r => r.coordinates).flat();

    // Create or update polylines for both routes
    if (!polylines) {
      polylines = {
        ovba: L.polyline(ovbaRoute.map(([lng, lat]) => [lat, lng]), {
          color: '#2196F3',
          weight: 3
        }).addTo(map),
        obab: L.polyline(obabRoute.map(([lng, lat]) => [lat, lng]), {
          color: '#f44336',
          weight: 3,
          dashArray: '10, 10'
        }).addTo(map)
      };
      
      // Initial tooltips
      polylines.ovba.bindTooltip('', { permanent: true, direction: 'right' });
      polylines.obab.bindTooltip('', { permanent: true, direction: 'left' });
    } else {
      polylines.ovba.setLatLngs(ovbaRoute.map(([lng, lat]) => [lat, lng]));
      polylines.obab.setLatLngs(obabRoute.map(([lng, lat]) => [lat, lng]));
    }

    // Update distances display
    const ovbaKm = (ovbaDistance/1000 ).toFixed(2);
    const obabKm = (obabDistance/1000 ).toFixed(2);
    const difference = ((obabDistance - (multiplier * ovbaDistance))/1000).toFixed(2);
    const differenceText = difference > 0 ? `+${difference}` : difference;

    document.getElementById('ovba-distance').textContent = `OVBA Distance: ${ovbaKm} km`;
    document.getElementById('obab-distance').textContent = `OBAB Distance: ${obabKm} km`;
    document.getElementById('distance-diff').textContent = `OVAB - OVBA = ${differenceText} km`;

    // Update tooltip contents (keep these simpler now)
    polylines.ovba.setTooltipContent(`OVBA: ${ovbaKm} km`);
    polylines.obab.setTooltipContent(`OAVB: ${obabKm} km`);

  } catch (error) {
    console.error('Error calculating routes:', error);
  }
}

function updatePolyline() {
  const coordinates = points.map(point => [point[1], point[0]]);
  polyline.setLatLngs(coordinates);
}

function draw() {
  // Not needed for Leaflet map
}

// Add slider event listener
document.getElementById('multiplier').addEventListener('input', function(e) {
    multiplier = parseFloat(e.target.value);
    document.getElementById('multiplier-value').textContent = multiplier.toFixed(1);
    updateRoutes();
});