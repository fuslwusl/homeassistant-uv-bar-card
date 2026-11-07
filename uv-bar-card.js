const UV_BAR_CARD_VERSION = "1.0.0";
const UV_BAR_CARD_REPO_URL = "https://github.com/fuslwusl/homeassistant-uv-bar-card";

class UVBarCard extends HTMLElement {
  // Card picker default: the first sensor with an hourly UV forecast.
  static getStubConfig(hass) {
    const states = hass?.states || {};
    const entity = Object.keys(states).find(id => {
      const forecast = states[id].attributes?.forecast;
      return Array.isArray(forecast) && forecast.length > 0 && forecast[0].uv_index !== undefined;
    });
    return { entity: entity || "sensor.uv_forecast", title: "UV-Index" };
  }

  set hass(hass) {
    if (!this.content) {
      this.innerHTML = `<ha-card style="padding: 12px; overflow: hidden;"></ha-card>`;
      this.content = this.querySelector('ha-card');
    }

    const entityId = this.config.entity;
    const state = hass.states[entityId];

    if (!state || !state.attributes.forecast) {
      this.content.innerHTML =
        `<div style="padding: 10px; color: red;">Sensor oder Forecast nicht gefunden.</div>`;
      return;
    }

    const rawForecast = state.attributes.forecast || [];
    const skinType = this.config.skin_type || 2;
    
    const medValues = {
      1: 200,
      2: 250,
      3: 350,
      4: 450,
      5: 600,
      6: 1000,
    };
    
    const med = medValues[skinType] || 250;

    // Optionaler aktueller UV-Sensor auslesen
    let currentUVHtml = "";
    let currentUVValue = "";
    if (this.config.current_entity) {
      const currentSensor = hass.states[this.config.current_entity];
      if (currentSensor && currentSensor.state !== 'unknown' && currentSensor.state !== 'unavailable') {
        currentUVValue = currentSensor.state;
        currentUVHtml = `<span style="font-size: var(--ha-font-size-m); font-weight: 500; margin-left: 6px;">${currentUVValue}</span>`;
      }
    }

    // Stundenwechsel erst bei :30 – Eintrag der aktuellen Stunde zwischenspeichern
    const now = new Date();
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    const firstEntry = rawForecast[0];
    const firstEntryHour = firstEntry ? new Date(firstEntry.datetime).getHours() : nowHour;

    if (firstEntry && firstEntryHour === nowHour) {
      this._cachedHourEntry = { hour: nowHour, entry: firstEntry };
    }

    let displayForecast = rawForecast;
    if (firstEntryHour !== nowHour && nowMinute < 30 &&
        this._cachedHourEntry && this._cachedHourEntry.hour === nowHour) {
      displayForecast = [this._cachedHourEntry.entry, ...rawForecast];
    }

    const forecast = displayForecast.slice(0, 12);
    const timeSlot = `${nowHour}-${nowMinute < 30 ? '0' : '30'}`;

    // Nur neu rendern, wenn sich UV, Zeit oder der aktuelle Wert geändert hat
    const forecastKey = forecast
      .map(h => `${h.datetime}-${Math.round(parseFloat(h.uv_index) || 0)}`)
      .join('|') + `|current-${currentUVValue}|slot-${timeSlot}`;

    if (this._forecastKey === forecastKey) {
      return;
    }

    this._forecastKey = forecastKey;

    // Maximalen UV-Wert der nächsten 12 Stunden bestimmen
    const maxUV = Math.max(
      ...forecast.map(h => Math.round(parseFloat(h.uv_index) || 0))
    );
    
    const iconColor =
      maxUV >= 3
        ? "var(--warning-color)"
        : "var(--secondary-text-color)";

    let protectionText = "∞";
    
    if (maxUV < 1) {
      protectionText = "unbegrenzt";
    } else {
      const minutes = Math.round(med / (maxUV * 1.5));
      protectionText = `${minutes} min`;
    }

    let titleHtml = "";
    
    if (this.config.title) {
      const icon = this.config.icon || "mdi:weather-sunny-alert";
    
      titleHtml = `
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding: 2px 4px 6px 4px;
          box-sizing:border-box;
          font-family:var(--ha-font-family);
        ">
    
          <div style="
            display:flex;
            align-items:center;
            gap:4px;
          ">
            <ha-icon
              icon="${icon}"
              style="
                color:${iconColor};
                --mdc-icon-size:20px;
                margin-right: 4px;
              ">
            </ha-icon>
    
            <span style="
              font-size:var(--ha-font-size-m);
              font-weight:500;
              color:var(--primary-text-color);
            ">
              ${this.config.title}
            </span>
            ${currentUVHtml}
          </div>
    
          <div style="
            display: flex;
            gap: 16px;
            text-align:right;
            line-height:1.1;
          ">
            <div>
              <div style="
                font-size:10px;
                color:var(--secondary-text-color);
              ">
                Max.
              </div>
      
              <div style="
                font-size:var(--ha-font-size-m);
                font-weight:normal;
                color:var(--primary-text-color);
              ">
                ${maxUV} UV
              </div>
            </div>

            <div>
              <div style="
                font-size:10px;
                color:var(--secondary-text-color);
              ">
                Eigenschutz
              </div>
      
              <div style="
                font-size:var(--ha-font-size-m);
                font-weight:normal;
                color:var(--primary-text-color);
              ">
                ${protectionText}
              </div>
            </div>
          </div>
    
        </div>
      `;
    }

    let html = titleHtml + `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        height:84px;
        margin-top:-2px;
        font-family:var(--ha-font-family);
        box-sizing:border-box;
        width:100%;
      ">
    `;

    forecast.forEach(h => {
      const uv = Math.round(parseFloat(h.uv_index) || 0);
      const date = new Date(h.datetime);
      const time = date.getHours().toString().padStart(2, '0');

      let color = '#007A15';
      if (uv >= 3 && uv < 6) color = '#D19000';
      else if (uv >= 6 && uv < 8) color = '#E67E22';
      else if (uv >= 8) color = '#A00000';

      const barHeight = Math.max(uv * 5.5, 5);

      html += `
        <div style="
          display:flex;
          flex-direction:column;
          align-items:center;
          flex:1;
          margin:0 2px;
          height:100%;
          justify-content:flex-end;
        ">
          <span style="
            font-size:12px;
            font-weight:bold;
            margin-bottom:2px;
            color:var(--primary-text-color);
          ">
            ${uv > 0 ? uv : '&nbsp;'}
          </span>

          <div style="
            background-color:${color};
            width:100%;
            max-width:18px;
            height:${barHeight}px;
            border-radius:4px;
          "></div>

          <span style="
            font-size:12px;
            color:var(--secondary-text-color);
            margin-top:4px;
          ">
            ${time}
          </span>
        </div>
      `;
    });

    html += `</div>`;

    this.content.innerHTML = html;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Bitte definiere eine Entität (entity)');
    }

    this.config = config;
  }

  getCardSize() {
    return 2;
  }
}

// Guard against double registration if the script is loaded twice
// (e.g. an old manual resource next to the HACS resource).
if (!customElements.get('uv-bar-card')) {
  customElements.define('uv-bar-card', UVBarCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'uv-bar-card')) {
  window.customCards.push({
    type: 'uv-bar-card',
    name: 'UV Bar Card',
    description: 'Stündliche UV-Index-Vorhersage als Balkendiagramm',
    preview: true,
    documentationURL: UV_BAR_CARD_REPO_URL,
  });
}

console.info(
  `%c UV-BAR-CARD %c v${UV_BAR_CARD_VERSION} `,
  'color:#fff;background:#E67E22;font-weight:700;border-radius:3px 0 0 3px',
  'color:#fff;background:#007A15;font-weight:700;border-radius:0 3px 3px 0',
);