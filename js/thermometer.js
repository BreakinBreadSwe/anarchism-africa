/* FairPlay Thermometer — scale-invariant football-impact index (v0).
 * Client-side only. Implements the carbon spine + four dials from
 * docs/SPEC-fairplay-thermometer.md. No backend, no dependencies.
 *
 * All emission factors are g CO2e per passenger-km (DEFRA-style — confirm
 * the flight factor against the current-year DEFRA dataset before any
 * public/marketing use). See docs/RESEARCH-modern-colosseum.md §6.
 */
(function () {
  'use strict';

  // g CO2e per passenger-km
  var EF = {
    intlRail: 6,
    coach: 30,
    natRail: 40,
    car: 60,    // assumes ~4 occupants; undivided is ~240
    bus: 89,
    flight: 250 // short-haul swing factor — pin exact current value before publishing
  };

  // Default dial weights (tunable per the spec)
  var WEIGHTS = { planet: 0.40, transport: 0.25, youth: 0.20, society: 0.15 };

  // Caliber presets pre-fill sensible defaults (mode mix sums to 100)
  var PRESETS = {
    grassroots: {
      label: 'Sunday youth match',
      attendance: 60, distance: 8,
      mix: { walk: 40, car: 50, bus: 10, coach: 0, natRail: 0, intlRail: 0, flight: 0 },
      gambling: 'none', alcohol: 0, youthPct: 60, newBuild: false, localVendors: true, accessible: true,
      grassroots: true
    },
    league: {
      label: 'National-league match',
      attendance: 20000, distance: 30,
      mix: { walk: 5, car: 45, bus: 20, coach: 5, natRail: 25, intlRail: 0, flight: 0 },
      gambling: 'heavy', alcohol: 8, youthPct: 15, newBuild: false, localVendors: true, accessible: false,
      grassroots: false
    },
    worldcup: {
      label: 'World Cup match',
      attendance: 60000, distance: 2000,
      mix: { walk: 2, car: 13, bus: 5, coach: 5, natRail: 5, intlRail: 0, flight: 70 },
      gambling: 'heavy', alcohol: 10, youthPct: 12, newBuild: true, localVendors: false, accessible: false,
      grassroots: false
    }
  };

  var MODE_KEYS = ['walk', 'car', 'bus', 'coach', 'natRail', 'intlRail', 'flight'];
  var MODE_EF = { walk: 0, car: EF.car, bus: EF.bus, coach: EF.coach, natRail: EF.natRail, intlRail: EF.intlRail, flight: EF.flight };
  var MODE_LABEL = { walk: 'Walk / cycle', car: 'Car', bus: 'Bus', coach: 'Coach', natRail: 'National rail', intlRail: 'Intl rail', flight: 'Flight' };

  // ---- scoring ------------------------------------------------------------

  // Per-attendee round-trip travel carbon, in kg CO2e
  function perAttendeeKg(distanceKm, mix) {
    var gPerKm = 0;
    MODE_KEYS.forEach(function (k) {
      gPerKm += (mix[k] / 100) * MODE_EF[k];
    });
    var grams = gPerKm * distanceKm * 2; // round trip
    return grams / 1000;
  }

  // Map kg/attendee -> 0..100 via the spec's piecewise bands
  function planetScore(kg) {
    var pts = [[0, 0], [5, 20], [15, 45], [60, 70], [200, 90], [600, 100]];
    for (var i = 1; i < pts.length; i++) {
      if (kg <= pts[i][0]) {
        var lo = pts[i - 1], hi = pts[i];
        var t = (kg - lo[0]) / (hi[0] - lo[0]);
        return Math.round(lo[1] + t * (hi[1] - lo[1]));
      }
    }
    return 100;
  }

  // Transport dial: share on low-carbon modes is good; car/flight is bad
  function transportScore(mix) {
    var bad = mix.car + mix.flight * 1.4; // flights weighted harder
    return Math.max(0, Math.min(100, Math.round(bad)));
  }

  // Youth & health dial: ad exposure minus participation benefit
  function youthScore(o) {
    var gambling = { none: 0, light: 25, moderate: 50, heavy: 80 }[o.gambling] || 0;
    var alcohol = Math.min(20, o.alcohol) * 1.0;            // up to ~20
    var exposure = gambling + alcohol;                       // 0..100-ish
    var youthWeight = 0.5 + (o.youthPct / 100) * 0.5;        // more kids = more harm weight
    var score = exposure * youthWeight;
    if (o.grassroots) score -= 25;                           // participation/belonging credit
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Society dial: new-build, blocked local vendors, inaccessible pricing all add heat
  function societyScore(o) {
    var s = 10;
    if (o.newBuild) s += 45;          // stadium debt / white-elephant risk
    if (!o.localVendors) s += 25;     // displaced informal economy
    if (!o.accessible) s += 20;       // pricing locks locals out
    return Math.max(0, Math.min(100, s));
  }

  function colorFor(temp) {
    // cool blue -> hot red
    var stops = [[0, [56, 132, 255]], [50, [240, 180, 40]], [100, [230, 50, 40]]];
    var lo = stops[0], hi = stops[stops.length - 1];
    for (var i = 1; i < stops.length; i++) {
      if (temp <= stops[i][0]) { hi = stops[i]; lo = stops[i - 1]; break; }
    }
    var t = (temp - lo[0]) / (hi[0] - lo[0] || 1);
    var c = lo[1].map(function (v, j) { return Math.round(v + t * (hi[1][j] - v)); });
    return 'rgb(' + c.join(',') + ')';
  }

  function verdict(temp) {
    if (temp < 25) return 'Cool — a low-impact event. The pyramid stays livable here.';
    if (temp < 50) return 'Warm — typical for organised football. Clear levers to cool it.';
    if (temp < 75) return 'Hot — travel and spectacle are doing real damage.';
    return 'Scorching — a modern colosseum. Most of the heat is avoidable.';
  }

  function compute(o) {
    var kg = perAttendeeKg(o.distance, o.mix);
    var dials = {
      planet: planetScore(kg),
      transport: transportScore(o.mix),
      youth: youthScore(o),
      society: societyScore(o)
    };
    var temp = Math.round(
      dials.planet * WEIGHTS.planet +
      dials.transport * WEIGHTS.transport +
      dials.youth * WEIGHTS.youth +
      dials.society * WEIGHTS.society
    );
    // biggest lever = highest weighted dial contribution
    var contrib = Object.keys(dials).map(function (k) { return { k: k, v: dials[k] * WEIGHTS[k] }; });
    contrib.sort(function (a, b) { return b.v - a.v; });
    return { kg: kg, totalKg: kg * o.attendance, dials: dials, temp: temp, lever: contrib[0].k };
  }

  // ---- DOM ----------------------------------------------------------------

  function $(s, r) { return (r || document).querySelector(s); }

  function readForm() {
    var mix = {};
    MODE_KEYS.forEach(function (k) { mix[k] = parseFloat($('#tm-mix-' + k).value) || 0; });
    return {
      attendance: parseFloat($('#tm-attendance').value) || 0,
      distance: parseFloat($('#tm-distance').value) || 0,
      mix: mix,
      gambling: $('#tm-gambling').value,
      alcohol: parseFloat($('#tm-alcohol').value) || 0,
      youthPct: parseFloat($('#tm-youth').value) || 0,
      newBuild: $('#tm-newbuild').checked,
      localVendors: $('#tm-vendors').checked,
      accessible: $('#tm-accessible').checked,
      grassroots: $('#tm-grassroots').checked
    };
  }

  function applyPreset(name) {
    var p = PRESETS[name]; if (!p) return;
    $('#tm-attendance').value = p.attendance;
    $('#tm-distance').value = p.distance;
    MODE_KEYS.forEach(function (k) { $('#tm-mix-' + k).value = p.mix[k]; });
    $('#tm-gambling').value = p.gambling;
    $('#tm-alcohol').value = p.alcohol;
    $('#tm-youth').value = p.youthPct;
    $('#tm-newbuild').checked = p.newBuild;
    $('#tm-vendors').checked = p.localVendors;
    $('#tm-accessible').checked = p.accessible;
    $('#tm-grassroots').checked = p.grassroots;
    render();
  }

  function modeSum() { var s = 0; MODE_KEYS.forEach(function (k) { s += parseFloat($('#tm-mix-' + k).value) || 0; }); return s; }

  function render() {
    var o = readForm();
    var sum = modeSum();
    var warn = $('#tm-mixwarn');
    warn.textContent = Math.abs(sum - 100) > 0.5 ? ('Transport mix = ' + sum + '% (should total 100%)') : '';

    var r = compute(o);
    var col = colorFor(r.temp);

    $('#tm-temp').textContent = r.temp + '°';
    $('#tm-temp').style.color = col;
    $('#tm-mercury').style.height = r.temp + '%';
    $('#tm-mercury').style.background = col;
    $('#tm-verdict').textContent = verdict(r.temp);

    $('#tm-kg').textContent = r.kg.toFixed(1) + ' kg CO₂e / attendee';
    $('#tm-total').textContent = (r.totalKg / 1000).toFixed(1) + ' t CO₂e total (' + (o.attendance || 0).toLocaleString() + ' attending)';

    [['planet', 'Planet'], ['transport', 'Transport'], ['youth', 'Youth & health'], ['society', 'Society']].forEach(function (d) {
      var v = r.dials[d[0]];
      $('#tm-dial-' + d[0] + ' .tm-dial-fill').style.width = v + '%';
      $('#tm-dial-' + d[0] + ' .tm-dial-fill').style.background = colorFor(v);
      $('#tm-dial-' + d[0] + ' .tm-dial-val').textContent = v;
    });

    var leverLabel = { planet: 'carbon (mostly travel)', transport: 'how fans travel', youth: 'gambling/alcohol exposure to young fans', society: 'venue & local-economy cost' };
    $('#tm-lever').textContent = 'Biggest lever: ' + leverLabel[r.lever] + '.';
  }

  function init() {
    if (!$('#tm-root')) return;
    $('#tm-root').addEventListener('input', render);
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('[data-preset]').forEach(function (x) { x.classList.remove('primary'); });
        b.classList.add('primary');
        applyPreset(b.dataset.preset);
      });
    });
    applyPreset('league'); // sensible default reading on load
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.FairPlayThermometer = { compute: compute, perAttendeeKg: perAttendeeKg, PRESETS: PRESETS };
})();
