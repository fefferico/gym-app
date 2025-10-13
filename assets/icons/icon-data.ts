// This file is a central repository for all your SVG icon strings.
// Using a Record<string, string> provides some type safety.

export const ICONS: Record<string, string> = {

  'eye-off': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clip-rule="evenodd" />
      <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.257 0-7.893-2.66-9.336-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
    </svg>
  `,
  'collapse': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path
            d="M 12 5 L 12 10 M 9 7 L 12 10 L 15 7 M 12 19 L 12 14 M 9 17 L 12 14 L 15 17"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  'plus': `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
    </svg>`,
  'plus-circle': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clip-rule="evenodd" />
    </svg>
  `,
  'minus': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <rect x="3" y="11" width="18" height="2" rx="1"></rect>
</svg>
  `,
  'home': `
      <svg 
  xmlns="http://www.w3.org/2000/svg" 
  width="24" 
  height="24" 
  viewBox="0 0 24 24" 
  fill="none" 
  stroke="currentColor" 
  stroke-width="2" 
  stroke-linecap="round" 
  stroke-linejoin="round">
    <path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
</svg>`
  ,
  'minus-circle': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clip-rule="evenodd" />
</svg>
  `,

  // Add all your other icons here...
  'trash': `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                            stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
  `,

  'hidden': `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd"
            d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
            clip-rule="evenodd" />
        <path
            d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.257 0-7.893-2.66-9.336-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
    </svg>
                                    `,
  'favourite': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round">
        <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
    `,
  'menu-action': `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round"
          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
  </svg>
    `,
  'routines': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
                    stroke="currentColor" 
                    aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
    `,
  'save': `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M15.2 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.8" />
                    <path d="M16 3.1 21 8" />
                    <path d="M8 21v-7h8v7" />
                    <path d="M8 3v5h8V3" />
                </svg>
          `,
  'stats': `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M2 3a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v11.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z M7.5 6a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1V6Z M13 9a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H14a1 1 0 0 1-1-1V9Z" />
    </svg>
`,
  'stats-new': `
<svg fill="currentColor" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M496 384H64V80c0-8.84-7.16-16-16-16H16C7.16 64 0 71.16 0 80v336c0 17.67 14.33 32 32 32h464c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16zM464 96H345.94c-21.38 0-32.09 25.85-16.97 40.97l32.4 32.4L288 242.75l-73.37-73.37c-12.5-12.5-32.76-12.5-45.25 0l-68.69 68.69c-6.25 6.25-6.25 16.38 0 22.63l22.62 22.62c6.25 6.25 16.38 6.25 22.63 0L192 237.25l73.37 73.37c12.5 12.5 32.76 12.5 45.25 0l96-96 32.4 32.4c15.12 15.12 40.97 4.41 40.97-16.97V112c.01-8.84-7.15-16-15.99-16z"></path></g></svg>
`,
  'update': `
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 3H4C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V4C21 3.44772 20.5523 3 20 3Z" stroke="#33363F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M16 3V9H8V3" stroke="#33363F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M12 18C13.6569 18 15 16.6569 15 15C15 13.3431 13.6569 12 12 12C10.3431 12 9 13.3431 9 15C9 16.6569 10.3431 18 12 18Z" stroke="#33363F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M14 15.5C14 16.3284 13.3284 17 12.5 17C11.6716 17 11 16.3284 11 15.5C11 14.6716 11.6716 14 12.5 14" stroke="#33363F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
    `,
  'create': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
          `,
  'create-folder': `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
`,
  'cancel': `
          <svg stroke="currentColor" fill="none" viewBox="0 0 8 8" class="w-4 h-4">
              <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
            </svg>
`,
  'cancel-circle': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
  <path d="M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
  'info': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                                class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help">
                                <path fill-rule="evenodd"
                                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                                    clip-rule="evenodd" />
                            </svg>
       `,
  'change': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                        stroke-linejoin="round">
                                        <polyline points="23 4 23 10 17 10"></polyline>
                                        <polyline points="1 20 1 14 7 14"></polyline>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                                        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                                    </svg>
       `,
  'back': `
<svg
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                `,
  'chevron-down': `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
</svg>`,
  'chevron-right': `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
</svg>`,
  'track-changes': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" stroke="currentColor">
  <path d="M0 0h24v24H0z" fill="none"/>
  <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83zM3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM5.92 19H5v-.92l9.06-9.06.92.92L5.92 19z"/>
</svg>`,
  'filter': `
                <svg stroke="currentColor" class="w-10 h-10 transition-transform duration-300" viewBox="0 0 24 24"
        stroke-width="0.02" fill="currentColor" xmlns="http://www.w3.org/2000/svg"
        [class.rotate-180]="currentView() === 'list' && isFilterAccordionOpen()">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M9 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM6.17 5a3.001 3.001 0 0 1 5.66 0H19a1 1 0 1 1 0 2h-7.17a3.001 3.001 0 0 1-5.66 0H5a1 1 0 0 1 0-2h1.17zM15 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2.83 0a3.001 3.001 0 0 1 5.66 0H19a1 1 0 1 1 0 2h-1.17a3.001 3.001 0 0 1-5.66 0H5a1 1 0 1 1 0-2h7.17zM9 17a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2.83 0a3.001 3.001 0 0 1 5.66 0H19a1 1 0 1 1 0 2h-7.17a3.001 3.001 0 0 1-5.66 0H5a1 1 0 1 1 0-2h1.17z" />
      </svg>
       `,
  'goal': `
       <svg fill="currentColor" viewBox="0 0 72 72" aria-hidden="true">
                                    <g>
                                        <path
                                            d="M21.929,10.583h3c0.553,0,1-0.447,1-1s-0.447-1-1-1h-3c-0.553,0-1,0.447-1,1S21.376,10.583,21.929,10.583z" />
                                        <path
                                            d="M29.929,10.583h8c0.553,0,1-0.447,1-1s-0.447-1-1-1h-8c-0.553,0-1,0.447-1,1S29.376,10.583,29.929,10.583z" />
                                        <path
                                            d="M41.074,43.893l-2.971-0.443l-1.287-2.796C36.49,39.944,35.78,39.49,35,39.49s-1.49,0.454-1.816,1.163l-1.288,2.796 l-2.97,0.443c-0.746,0.112-1.366,0.635-1.604,1.352c-0.236,0.717-0.049,1.506,0.484,2.04l2.165,2.168l-0.708,3.16 c-0.175,0.78,0.133,1.591,0.782,2.059c0.348,0.251,0.759,0.378,1.17,0.378c0.355,0,0.712-0.095,1.03-0.285l2.769-1.664l2.964,1.688 c0.308,0.176,0.649,0.262,0.989,0.262c0.435,0,0.867-0.142,1.226-0.42c0.639-0.495,0.917-1.326,0.704-2.105l-0.844-3.097 l2.14-2.143c0.533-0.534,0.721-1.323,0.484-2.04C42.44,44.527,41.82,44.005,41.074,43.893z M38.202,48.451 c-0.216,0.216-0.313,0.52-0.264,0.818l1.029,3.779l-3.496-1.99c-0.146-0.078-0.309-0.117-0.472-0.117s-0.325,0.039-0.472,0.117 l-3.313,1.99l0.846-3.779c0.05-0.299-0.048-0.603-0.264-0.818l-2.576-2.58l3.515-0.525c0.321-0.049,0.598-0.25,0.735-0.537 L35,41.49l1.528,3.318c0.138,0.287,0.414,0.488,0.735,0.537l3.515,0.525L38.202,48.451z" />
                                        <path
                                            d="M47.874,32.213l3.275-3.227c0.389-0.377,0.434-0.895,0.434-1.436v-9.054c3-1.049,5.453-4.214,5.453-7.757 c0-4.411-3.608-8.157-7.999-8.157H20.962c-4.391,0-7.926,3.746-7.926,8.157c0,3.552,2.547,6.725,5.547,7.766v9.045 c0,0.541,0.392,1.059,0.78,1.436l3.142,2.914c-4.463,3.64-7.329,9.176-7.329,15.369c0,10.936,8.893,19.833,19.829,19.833 c10.936,0,19.831-8.897,19.831-19.833C54.835,41.247,52.125,35.854,47.874,32.213z M40.583,28.231v-9.648h7v8.122l-3.041,3.145 C43.299,29.17,41.583,28.634,40.583,28.231z M38.583,18.583v9.184c-1-0.205-2.312-0.33-3.512-0.33 c-1.192,0-2.488,0.124-3.488,0.326v-9.18H38.583z M17,10.583c0-2.209,1.774-4,3.962-4h27.55l0.316-0.025 c2.189,0,4.067,1.999,4.067,4.208c0,2.208-1.669,3.817-3.858,3.817H20.962C18.774,14.583,17,12.791,17,10.583z M22.583,26.705 v-8.122h7v9.643c-1,0.374-2.536,0.871-3.708,1.488L22.583,26.705z M35,63.103c-8.745,0-15.833-7.087-15.833-15.833 S26.255,31.437,35,31.437s15.833,7.087,15.833,15.833S43.745,63.103,35,63.103z" />
                                        <path
                                            d="M32.5,36.637c0.027,0,0.055-0.001,0.083-0.003c0.246-0.021,0.498-0.031,0.75-0.031c0.553,0,1-0.447,1-1s-0.447-1-1-1 c-0.307,0-0.613,0.013-0.914,0.037c-0.55,0.046-0.96,0.528-0.915,1.079C31.547,36.241,31.984,36.637,32.5,36.637z" />
                                        <path
                                            d="M29.584,37.419c0.502-0.23,0.723-0.824,0.492-1.326c-0.231-0.503-0.826-0.721-1.326-0.492 c-3.898,1.789-6.417,5.715-6.417,10.003c0,0.553,0.447,1,1,1s1-0.447,1-1C24.333,42.095,26.395,38.883,29.584,37.419z" />
                                    </g>
                                </svg> `,
  'dumbbell': `
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 500" fill="currentColor">
      <path
        d="M96 64c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32l0 160 0 64 0 160c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-64-32 0c-17.7 0-32-14.3-32-32l0-64c-17.7 0-32-14.3-32-32s14.3-32 32-32l0-64c0-17.7 14.3-32 32-32l32 0 0-64zm448 0l0 64 32 0c17.7 0 32 14.3 32 32l0 64c17.7 0 32 14.3 32 32s-14.3 32-32 32l0 64c0 17.7-14.3 32-32 32l-32 0 0 64c0 17.7-14.3 32-32 32l-32 0c-17.7 0-32-14.3-32-32l0-160 0-64 0-160c0-17.7 14.3-32 32-32l32 0c17.7 0 32 14.3 32 32zM416 224l0 64-192 0 0-64 192 0z" />
    </svg>
  `,
  'muscle': `
                                <svg stroke="currentColor" stroke-width="3" viewBox="-3 0 60 60"
                                aria-hidden="true">
                                <g>
                                    <path
                                        d="M1.434,28.084c1.527,0.188,3.644,0.847,3.644,1.587c0,0.207,0.128,0.393,0.321,0.467c0.189,0.073,0.412,0.021,0.551-0.133 c0.026-0.027,2.688-2.917,7.878-2.917c5.405,0,8.5,2.556,8.5,3.25c0,0.241,0.172,0.447,0.408,0.491 c0.24,0.044,0.471-0.087,0.559-0.312c0.019-0.051,1.904-4.85,4.922-4.85c0.01,0,0.021,0,0.027,0 c1.557,0.018,4.362,0.042,6.073,2.143c0.193,0.269,0.318,0.438,0.354,0.486c0.16,0.223,0.467,0.271,0.688,0.116 s0.281-0.456,0.136-0.686c-0.118-0.184-0.243-0.354-0.372-0.518c-1.658-2.314-8.548-12.151-8.548-15.794 c0-0.194-0.112-0.371-0.288-0.453c-0.175-0.083-0.382-0.056-0.531,0.068c-0.058,0.047-5.736,4.688-10.149,1.041 c-0.052-0.056-1.274-1.379-0.466-2.437c0.094-0.123,0.124-0.282,0.085-0.432s-0.146-0.272-0.289-0.333 c-0.008-0.003-0.812-0.354-1.062-1.093c-0.164-0.483-0.062-1.055,0.304-1.7c1.356-2.392,3.701-4.431,3.779-4.506 c0.012-0.014,1.186-1.341,3.882,0.116c0.351,0.189,0.768,0.409,1.236,0.656c3.612,1.901,10.334,5.439,12.925,9.109 c0.548,0.773,1.248,1.658,2.062,2.682c3.635,4.578,9.113,11.486,9.43,19.683c-0.25,0.541-1.715,3.412-5.574,5.773 c-3.948,2.418-11.291,4.786-23.824,2.332c-0.13-0.025-0.272,0.002-0.385,0.082c-0.113,0.079-0.187,0.2-0.206,0.338 c-0.006,0.039-0.591,3.967-2.71,6.318c-0.185,0.205-0.168,0.521,0.037,0.706c0.096,0.086,0.216,0.128,0.335,0.128 c0.137,0,0.272-0.056,0.372-0.166c1.867-2.074,2.626-5.123,2.865-6.331c3.566,0.67,6.729,0.956,9.533,0.956 c16.356-0.001,20.479-9.74,20.523-9.854c0.026-0.064,0.038-0.135,0.036-0.203c-0.276-8.578-5.917-15.683-9.646-20.385 c-0.806-1.012-1.496-1.887-2.025-2.638c-2.729-3.866-9.592-7.477-13.278-9.417c-0.465-0.245-0.879-0.463-1.228-0.651 c-3.397-1.837-5.051,0.036-5.063,0.062c-0.102,0.087-2.499,2.169-3.941,4.715c-0.515,0.908-0.643,1.758-0.378,2.525 c0.237,0.689,0.741,1.144,1.126,1.405c-0.558,1.27,0.255,2.644,0.868,3.285c4.082,3.376,8.941,0.736,10.749-0.476 c0.651,3.412,4.48,9.436,6.937,13.036c-1.628-0.668-3.354-0.686-4.443-0.695c-2.725-0.035-4.565,2.925-5.363,4.513 c-1.268-1.495-4.704-3.096-8.974-3.096c-4.277,0-6.947,1.781-8.048,2.708c-0.904-1.229-3.599-1.627-4.225-1.704 c-0.268-0.035-0.522,0.161-0.557,0.437C0.965,27.799,1.16,28.05,1.434,28.084z" />
                                    <path
                                        d="M30.738,39.531c1.036,0,2.114-0.15,3.146-0.551c1.934-0.75,3.356-2.25,4.239-4.457c0.104-0.256-0.021-0.547-0.276-0.65 c-0.256-0.103-0.547,0.021-0.647,0.279c-0.771,1.938-2.013,3.248-3.671,3.895c-3.604,1.402-8.104-0.721-8.146-0.743 c-0.25-0.119-0.549-0.015-0.668,0.233c-0.12,0.249-0.016,0.547,0.233,0.667C25.093,38.275,27.739,39.531,30.738,39.531z" />
                                </g>
                            </svg>
                            `,
  'calendar': `
                            <svg fill="none" viewBox="0 0 24 24" stroke-width="2"
                                stroke="currentColor" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3.75h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                            </svg>
`,
  'calendar-page': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" 
viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" >
<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          `,
  'clock': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"></circle>
  <polyline points="12 6 12 12 16 12"></polyline>
</svg>`,
  'play': `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" 
            stroke-width="2" stroke="currentColor" >
            <path stroke-linecap="round" stroke-linejoin="round" 
            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"></path></svg>
  `,
  'profile': `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"  stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.875 1.875 0 0 1 18.126 22.5H5.874a1.875 1.875 0 0 1-1.373-2.382Z"></path></svg>
  `,
  'schedule': `
  <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                      viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
                      <path stroke-linecap="round" stroke-linejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
  `,
  'export': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17 3h4v4M11 13L21 3M19 13.89V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 4-5h6.11"/>
</svg>
`,
  'exercise-list': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25">
</path>
</svg>
`,
  'weight': `
<svg viewBox="0 -0.5 17 17" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="si-glyph si-glyph-weight-up" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>674</title> <defs> </defs> <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <path d="M12.867,3.039 L11.944,3.039 C11.978,2.887 12,2.719 12,2.531 C12,1.135 10.877,0 9.495,0 C8.113,0 6.99,1.135 6.99,2.531 C6.99,2.719 7.016,2.886 7.058,3.039 L6.136,3.039 C5.011,3.039 4.099,3.922 4.099,5.01 L2.083,13.985 C2.083,15.075 2.873,15.957 4,15.957 L15,15.957 C16.126,15.957 16.917,15.075 16.917,13.985 L14.905,5.01 C14.905,3.922 13.993,3.039 12.867,3.039 Z M7.824,2.531 C7.824,1.582 8.573,0.808 9.495,0.808 C10.416,0.808 11.165,1.581 11.165,2.531 C11.165,2.709 11.131,2.877 11.082,3.039 L7.906,3.039 C7.857,2.877 7.824,2.709 7.824,2.531 L7.824,2.531 Z M10.054,10.08 L10.054,13.039 L8.946,13.039 L8.946,10.101 L6.813,10.08 L9.543,7.02 L12.107,10.08 L10.054,10.08 L10.054,10.08 Z" fill="currentColor" class="si-glyph-fill"> </path> </g> </g></svg>`,
  'pb': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
<g id="SVGRepo_iconCarrier">
<path d="M12.0002 16C6.24021 16 5.21983 10.2595 5.03907 5.70647C4.98879 4.43998 4.96365 3.80673 5.43937 3.22083C5.91508 2.63494 6.48445 2.53887 7.62318 2.34674C8.74724 2.15709 10.2166 2 12.0002 2C13.7837 2 15.2531 2.15709 16.3771 2.34674C17.5159 2.53887 18.0852 2.63494 18.5609 3.22083C19.0367 3.80673 19.0115 4.43998 18.9612 5.70647C18.7805 10.2595 17.7601 16 12.0002 16Z" stroke="currentColor" stroke-width="1.5"></path><path d="M12 16V19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M15.5 22H8.5L8.83922 20.3039C8.93271 19.8365 9.34312 19.5 9.8198 19.5H14.1802C14.6569 19.5 15.0673 19.8365 15.1608 20.3039L15.5 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M19 5L19.9486 5.31621C20.9387 5.64623 21.4337 5.81124 21.7168 6.20408C22 6.59692 22 7.11873 21.9999 8.16234L21.9999 8.23487C21.9999 9.09561 21.9999 9.52598 21.7927 9.87809C21.5855 10.2302 21.2093 10.4392 20.4569 10.8572L17.5 12.5" stroke="currentColor" stroke-width="1.5"></path><path d="M4.99994 5L4.05132 5.31621C3.06126 5.64623 2.56623 5.81124 2.2831 6.20408C1.99996 6.59692 1.99997 7.11873 2 8.16234L2 8.23487C2.00003 9.09561 2.00004 9.52598 2.20723 9.87809C2.41441 10.2302 2.79063 10.4392 3.54305 10.8572L6.49994 12.5" stroke="currentColor" stroke-width="1.5"></path><path d="M11.1459 6.02251C11.5259 5.34084 11.7159 5 12 5C12.2841 5 12.4741 5.34084 12.8541 6.02251L12.9524 6.19887C13.0603 6.39258 13.1143 6.48944 13.1985 6.55334C13.2827 6.61725 13.3875 6.64097 13.5972 6.68841L13.7881 6.73161C14.526 6.89857 14.895 6.98205 14.9828 7.26432C15.0706 7.54659 14.819 7.84072 14.316 8.42898L14.1858 8.58117C14.0429 8.74833 13.9714 8.83191 13.9392 8.93531C13.9071 9.03872 13.9179 9.15023 13.9395 9.37327L13.9592 9.57632C14.0352 10.3612 14.0733 10.7536 13.8435 10.9281C13.6136 11.1025 13.2682 10.9435 12.5773 10.6254L12.3986 10.5431C12.2022 10.4527 12.1041 10.4075 12 10.4075C11.8959 10.4075 11.7978 10.4527 11.6014 10.5431L11.4227 10.6254C10.7318 10.9435 10.3864 11.1025 10.1565 10.9281C9.92674 10.7536 9.96476 10.3612 10.0408 9.57632L10.0605 9.37327C10.0821 9.15023 10.0929 9.03872 10.0608 8.93531C10.0286 8.83191 9.95713 8.74833 9.81418 8.58117L9.68403 8.42898C9.18097 7.84072 8.92945 7.54659 9.01723 7.26432C9.10501 6.98205 9.47396 6.89857 10.2119 6.73161L10.4028 6.68841C10.6125 6.64097 10.7173 6.61725 10.8015 6.55334C10.8857 6.48944 10.9397 6.39258 11.0476 6.19887L11.1459 6.02251Z" stroke="currentColor" stroke-width="1.5"></path><path d="M18 22H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></g></svg>
`,
  'drag': `
<svg  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ><path d="M 7 17 L 7 3 M 4 6 L 7 3 L 10 6 M 17 7 L 17 21 M 14 18 L 17 21 L 20 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
`,
  'reorder': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M10 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM10 16h4v4h-4z"></path></svg>
`,
  'pause': `
<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" />
      <rect x="7" y="6" width="2" height="9" rx="4" ry="4" fill="currentColor" />
      <rect x="11" y="6" width="2" height="9" rx="4" ry="4" fill="currentColor" />
    </svg>`,
  'eye': `
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z"></path>
            <path fill-rule="evenodd"
              d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z"
              clip-rule="evenodd"></path>
          </svg>
`,
  'done': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" ><defs><mask id="tickCutoutMask">
<rect x="0" y="0" width="24" height="24" fill="white">
</rect>
<path d="M7.5 12.5L10.5 15.5L16.5 9.5" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"></path></mask></defs><circle cx="12" cy="12" r="10" fill="currentColor" mask="url(#tickCutoutMask)"></circle></svg>
`,
  'skip': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5 18L13 12L5 6V18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M13 18L21 12L13 6V18Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M21 6V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`,
  'skip-filled': `
<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
<path d="M5 6V18L13 12L5 6Z"/>
<path d="M13 6V18L21 12L13 6Z"/>
<path d="M21 6H23V18H21V6Z"/>
</svg>
`,
  'collapse-card': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clip-rule="evenodd" />
                </svg>
`,
  'alert': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
</svg>
`,
  'alert-filled': `
<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
</svg>
`,
  'chart': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.5v-7.5c0-1.105.895-2 2-2h14c1.105 0 2 .895 2 2v10.5c0 1.105-.895 2-2 2h-14a2 2 0 0 1-2-2v-2.5" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16.5v-5.25m4 5.25v-2.25m4 2.25v-1.5" />
</svg>
`,
  'chart2': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
  <path d="M2 3a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v11.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z" />
  <path d="M7.5 6a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1V6Z" />
  <path d="M13 9a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H14a1 1 0 0 1-1-1V9Z" />
</svg>
`,
  'chart3': `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M10 90H90" stroke="currentColor" stroke-width="4"/>
<path d="M10 90V10" stroke="currentColor" stroke-width="4"/>
<path d="M20 70L40 50L60 60L80 30" stroke="currentColor" stroke-width="4"/>
</svg>
`,

  'edit': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10">
  </path>
</svg>
`,
  'magnifier': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
</svg>
`,
  'trend': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                            stroke="currentColor" >
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                        </svg>
`,
  'activate': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                        fill="currentColor">
                        <path fill-rule="evenodd"
                          d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75Zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
                          clip-rule="evenodd" />
                      </svg>
                       `,
  'deactivate': `
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="10"/>
  <line x1="25" y1="50" x2="75" y2="50" stroke="currentColor" stroke-width="10"/>
</svg>
`,
  'clipboard-list': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
  <line x1="12" y1="11" x2="12" y2="11"></line>
  <line x1="8" y1="11" x2="8" y2="11"></line>
  <line x1="8" y1="15" x2="8" y2="15"></line>
  <line x1="12" y1="15" x2="16" y2="15"></line>
  <line x1="12" y1="11" x2="16" y2="11"></line>
</svg>
`,
  'flame': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
</svg>
`,
  'flame-2': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke-width="1.5"
                            stroke="currentColor" class="w-10 h-10 transition-transform duration-300">
                            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                                <path
                                    d="M20 15C20 19.2545 17.3819 21.1215 15.3588 21.751C14.9274 21.8853 14.6438 21.3823 14.9019 21.0115C15.7823 19.7462 16.8 17.8159 16.8 16C16.8 14.0494 15.1559 11.7465 13.8721 10.3261C13.5786 10.0014 13.0667 10.2163 13.0507 10.6537C12.9976 12.1029 12.7689 14.0418 11.7828 15.5614C11.6241 15.806 11.2872 15.8262 11.1063 15.5975C10.7982 15.2079 10.4901 14.7265 10.182 14.3462C10.016 14.1414 9.71604 14.1386 9.52461 14.3198C8.77825 15.0265 7.73333 16.1286 7.73333 17.5C7.73333 18.4893 8.20479 19.7206 8.69077 20.6741C8.91147 21.1071 8.50204 21.615 8.08142 21.3715C6.24558 20.3088 4 18.1069 4 15C4 11.8536 8.31029 7.49484 9.95605 3.37694C10.2157 2.72714 11.0161 2.42181 11.5727 2.84585C14.9439 5.41391 20 10.3781 20 15Z"
                                    stroke="currentColor" stroke-width="1.5"></path>
                            </g>
                        </svg>`,
  'map': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22s-8-6-8-12a8 8 0 0 1 16 0c0 6-8 12-8 12z"></path>
  <circle cx="12" cy="10" r="3"></circle>
</svg>
`,
'repeat':  `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9.5 19.75C9.91421 19.75 10.25 19.4142 10.25 19C10.25 18.5858 9.91421 18.25 9.5 18.25V19.75ZM11 5V5.75C11.3033 5.75 11.5768 5.56727 11.6929 5.28701C11.809 5.00676 11.7448 4.68417 11.5303 4.46967L11 5ZM9.53033 2.46967C9.23744 2.17678 8.76256 2.17678 8.46967 2.46967C8.17678 2.76256 8.17678 3.23744 8.46967 3.53033L9.53033 2.46967ZM9.5 18.25H9.00028V19.75H9.5V18.25ZM9 5.75H11V4.25H9V5.75ZM11.5303 4.46967L9.53033 2.46967L8.46967 3.53033L10.4697 5.53033L11.5303 4.46967ZM1.25 12C1.25 16.2802 4.72011 19.75 9.00028 19.75V18.25C5.54846 18.25 2.75 15.4517 2.75 12H1.25ZM2.75 12C2.75 8.54822 5.54822 5.75 9 5.75V4.25C4.71979 4.25 1.25 7.71979 1.25 12H2.75Z" fill="currentColor"></path> <path d="M13 19V18.25C12.6967 18.25 12.4232 18.4327 12.3071 18.713C12.191 18.9932 12.2552 19.3158 12.4697 19.5303L13 19ZM14.4697 21.5303C14.7626 21.8232 15.2374 21.8232 15.5303 21.5303C15.8232 21.2374 15.8232 20.7626 15.5303 20.4697L14.4697 21.5303ZM14.5 4.25C14.0858 4.25 13.75 4.58579 13.75 5C13.75 5.41421 14.0858 5.75 14.5 5.75V4.25ZM15 18.25H13V19.75H15V18.25ZM12.4697 19.5303L14.4697 21.5303L15.5303 20.4697L13.5303 18.4697L12.4697 19.5303ZM14.5 5.75H15V4.25H14.5V5.75ZM21.25 12C21.25 15.4518 18.4518 18.25 15 18.25V19.75C19.2802 19.75 22.75 16.2802 22.75 12H21.25ZM22.75 12C22.75 7.71979 19.2802 4.25 15 4.25V5.75C18.4518 5.75 21.25 8.54822 21.25 12H22.75Z" fill="currentColor"></path> <path d="M10.5 11.5L12 10V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
 `,
  'loading': `
<svg class="animate-spin h-8 w-8 text-primary dark:text-primary-light mx-auto"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
          </path>
        </svg>`,
  'distance': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="8" width="20" height="8" rx="1" ry="1"></rect>
  <line x1="5" y1="8" x2="5" y2="12"></line>
  <line x1="9" y1="8" x2="9" y2="12"></line>
  <line x1="13" y1="8" x2="13" y2="12"></line>
  <line x1="17" y1="8" x2="17" y2="12"></line>
  <line x1="21" y1="8" x2="21" y2="12"></line>
</svg>
`,
  'calories': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect>
  <path d="M7 12a5 5 0 0 1 10 0v0"></path>
  <line x1="12" y1="12" x2="14" y2="10"></line>
</svg>
`,
  'exit-door': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
  <polyline points="16 17 21 12 16 7"></polyline>
  <line x1="21" y1="12" x2="9" y2="12"></line>
</svg>
`,
  'message': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="h-4 w-4"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
 `,
  'rest': `
<svg fill="currentColor" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M 38.5235 11.1251 L 33.1797 11.1251 L 33.1797 10.9844 L 38.6407 3.7892 C 39.1329 3.1565 39.3204 2.7581 39.3204 2.3361 C 39.3204 1.6094 38.7578 1.1640 37.9844 1.1640 L 30.4610 1.1640 C 29.7578 1.1640 29.2188 1.6329 29.2188 2.3597 C 29.2188 3.1329 29.7578 3.5782 30.4610 3.5782 L 35.5000 3.5782 L 35.5000 3.7188 L 29.9688 10.8907 C 29.4766 11.5235 29.2891 11.8751 29.2891 12.3673 C 29.2891 13.0470 29.8282 13.5392 30.6016 13.5392 L 38.5235 13.5392 C 39.2266 13.5392 39.7422 13.0938 39.7422 12.3204 C 39.7422 11.5938 39.2266 11.1251 38.5235 11.1251 Z M 49.4924 20.0782 L 45.7188 20.0782 L 45.7188 19.9844 L 49.6095 14.8985 C 50.0545 14.3126 50.2422 13.9376 50.2422 13.5157 C 50.2422 12.8360 49.7031 12.4141 48.9766 12.4141 L 43.2344 12.4141 C 42.5782 12.4141 42.0860 12.8595 42.0860 13.5392 C 42.0860 14.2892 42.5782 14.7110 43.2344 14.7110 L 46.6329 14.7110 L 46.6329 14.8048 L 42.7657 19.8907 C 42.3204 20.4532 42.1563 20.8048 42.1563 21.2970 C 42.1563 21.9297 42.6485 22.3985 43.3751 22.3985 L 49.4924 22.3985 C 50.1721 22.3985 50.6406 21.9532 50.6406 21.2501 C 50.6406 20.5470 50.1721 20.0782 49.4924 20.0782 Z M 25.9844 54.8360 C 34.5157 54.8360 41.4531 50.5001 44.5938 43.0001 C 44.9922 42.0626 44.9219 41.2892 44.4531 40.8204 C 44.1016 40.4454 43.3751 40.3985 42.6251 40.7032 C 40.6797 41.4766 38.4297 41.8048 35.9922 41.8048 C 25.4922 41.8048 18.6251 35.1485 18.6251 25.0235 C 18.6251 22.2579 19.1641 19.1876 19.8907 17.7579 C 20.3360 16.8438 20.3360 16.0704 19.9610 15.6017 C 19.5391 15.0860 18.7657 14.9923 17.7578 15.3438 C 10.2813 18.0860 5.3594 25.9141 5.3594 34.6095 C 5.3594 46.2344 14.1251 54.8360 25.9844 54.8360 Z M 39.1563 28.0938 L 35.9453 28.0938 L 35.9453 28.0001 L 39.2500 23.6173 C 39.6719 23.0313 39.8594 22.7032 39.8594 22.3048 C 39.8594 21.6485 39.3438 21.2501 38.6641 21.2501 L 33.6016 21.2501 C 32.9688 21.2501 32.5000 21.6719 32.5000 22.3282 C 32.5000 23.0313 32.9688 23.4297 33.6016 23.4297 L 36.4141 23.4297 L 36.4141 23.5235 L 33.1563 27.8829 C 32.7344 28.4454 32.5704 28.7735 32.5704 29.2188 C 32.5704 29.8282 33.0391 30.2970 33.7188 30.2970 L 39.1563 30.2970 C 39.7891 30.2970 40.2344 29.8517 40.2344 29.1719 C 40.2344 28.5392 39.7891 28.0938 39.1563 28.0938 Z"></path></g></svg>
  `,
  'reps':`
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M5.99999 5.5C5.99999 5.22386 5.77613 5 5.49999 5C5.22385 5 4.99999 5.22386 4.99999 5.5V8.5C4.99999 8.77614 5.22385 9 5.49999 9C5.77613 9 5.99999 8.77614 5.99999 8.5V5.5ZM5.25046 11.2673C5.38308 11.1789 5.55766 11.1864 5.68212 11.286C5.85245 11.4223 5.86653 11.6764 5.71228 11.8306L4.39644 13.1464C4.25344 13.2894 4.21066 13.5045 4.28805 13.6913C4.36544 13.8782 4.54776 14 4.74999 14H6.49999C6.77613 14 6.99999 13.7761 6.99999 13.5C6.99999 13.2239 6.77613 13 6.49999 13H5.9571L6.41939 12.5377C6.99508 11.962 6.94256 11.0137 6.30681 10.5051C5.8423 10.1335 5.19072 10.1053 4.69576 10.4352L4.47264 10.584C4.24288 10.7372 4.18079 11.0476 4.33397 11.2773C4.48714 11.5071 4.79758 11.5692 5.02734 11.416L5.25046 11.2673ZM4.74999 15.5C4.47385 15.5 4.24999 15.7239 4.24999 16C4.24999 16.2761 4.47385 16.5 4.74999 16.5H5.29288L4.64644 17.1464C4.50344 17.2894 4.46066 17.5045 4.53805 17.6913C4.61544 17.8782 4.79776 18 4.99999 18H5.74999C5.88806 18 5.99999 18.1119 5.99999 18.25C5.99999 18.3881 5.88806 18.5 5.74999 18.5H4.74999C4.47385 18.5 4.24999 18.7239 4.24999 19C4.24999 19.2761 4.47385 19.5 4.74999 19.5H5.74999C6.44035 19.5 6.99999 18.9404 6.99999 18.25C6.99999 17.6972 6.6412 17.2283 6.1438 17.0633L6.85355 16.3536C6.99654 16.2106 7.03932 15.9955 6.96193 15.8087C6.88454 15.6218 6.70222 15.5 6.49999 15.5H4.74999ZM8.99999 6C8.44771 6 7.99999 6.44772 7.99999 7C7.99999 7.55228 8.44771 8 8.99999 8H19C19.5523 8 20 7.55228 20 7C20 6.44772 19.5523 6 19 6H8.99999ZM8.99999 11C8.44771 11 7.99999 11.4477 7.99999 12C7.99999 12.5523 8.44771 13 8.99999 13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H8.99999ZM8.99999 16C8.44771 16 7.99999 16.4477 7.99999 17C7.99999 17.5523 8.44771 18 8.99999 18H19C19.5523 18 20 17.5523 20 17C20 16.4477 19.5523 16 19 16H8.99999Z" fill="currentColor"></path> </g></svg>
  `,
  'tempo':
  `
  <svg fill="currentColor" version="1.1" id="Icons" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M16,21c0.3,0,0.6-0.1,0.8-0.4l13-17c0.3-0.4,0.3-1.1-0.2-1.4c-0.4-0.3-1.1-0.3-1.4,0.2l-5.7,7.5l-1-4.8 c-0.4-1.8-2-3.1-3.8-3.1h-3.4c-1.8,0-3.4,1.2-3.8,3L5.8,25.5c-0.3,1.1,0,2.2,0.7,3.1C7.2,29.5,8.2,30,9.3,30h13.3 c1.1,0,2.2-0.5,2.9-1.4c0.7-0.9,0.9-2,0.7-3.1l-2.5-9.7c-0.1-0.5-0.7-0.9-1.2-0.7c-0.5,0.1-0.9,0.7-0.7,1.2l1.5,5.8H8.6l3.8-16.5 c0.2-0.9,1-1.5,1.8-1.5h3.4c0.9,0,1.7,0.6,1.8,1.5l1.4,6.5l-5.6,7.4c-0.3,0.4-0.3,1.1,0.2,1.4C15.6,20.9,15.8,21,16,21z"></path> <path d="M15,8h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S14.4,8,15,8z"></path> <path d="M15,11h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S14.4,11,15,11z"></path> <path d="M15,14h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S14.4,14,15,14z"></path> </g> </g></svg>
  `,
  'copy': `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path d="M 5 3 H 16 A 2 2 0 0 1 18 5 V 16 A 2 2 0 0 1 16 18 H 5 A 2 2 0 0 1 3 16 V 5 A 2 2 0 0 1 5 3 Z M 8 6 H 19 A 2 2 0 0 1 21 8 V 19 A 2 2 0 0 1 19 21 H 8 A 2 2 0 0 1 6 19 V 8 A 2 2 0 0 1 8 6 Z" /></svg>
  `,
  'gear': `
<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M16 12a4 4 0 11-8 0 4 4 0 018 0zm-1.5 0a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/><path fill-rule="evenodd" d="M12 1c-.268 0-.534.01-.797.028-.763.055-1.345.617-1.512 1.304l-.352 1.45c-.02.078-.09.172-.225.22a8.45 8.45 0 00-.728.303c-.13.06-.246.044-.315.002l-1.274-.776c-.604-.368-1.412-.354-1.99.147-.403.348-.78.726-1.129 1.128-.5.579-.515 1.387-.147 1.99l.776 1.275c.042.069.059.185-.002.315-.112.237-.213.48-.302.728-.05.135-.143.206-.221.225l-1.45.352c-.687.167-1.249.749-1.304 1.512a11.149 11.149 0 000 1.594c.055.763.617 1.345 1.304 1.512l1.45.352c.078.02.172.09.22.225.09.248.191.491.303.729.06.129.044.245.002.314l-.776 1.274c-.368.604-.354 1.412.147 1.99.348.403.726.78 1.128 1.129.579.5 1.387.515 1.99.147l1.275-.776c.069-.042.185-.059.315.002.237.112.48.213.728.302.135.05.206.143.225.221l.352 1.45c.167.687.749 1.249 1.512 1.303a11.125 11.125 0 001.594 0c.763-.054 1.345-.616 1.512-1.303l.352-1.45c.02-.078.09-.172.225-.22.248-.09.491-.191.729-.303.129-.06.245-.044.314-.002l1.274.776c.604.368 1.412.354 1.99-.147.403-.348.78-.726 1.129-1.128.5-.579.515-1.387.147-1.99l-.776-1.275c-.042-.069-.059-.185.002-.315.112-.237.213-.48.302-.728.05-.135.143-.206.221-.225l1.45-.352c.687-.167 1.249-.749 1.303-1.512a11.125 11.125 0 000-1.594c-.054-.763-.616-1.345-1.303-1.512l-1.45-.352c-.078-.02-.172-.09-.22-.225a8.469 8.469 0 00-.303-.728c-.06-.13-.044-.246-.002-.315l.776-1.274c.368-.604.354-1.412-.147-1.99-.348-.403-.726-.78-1.128-1.129-.579-.5-1.387-.515-1.99-.147l-1.275.776c-.069.042-.185.059-.315-.002a8.465 8.465 0 00-.728-.302c-.135-.05-.206-.143-.225-.221l-.352-1.45c-.167-.687-.749-1.249-1.512-1.304A11.149 11.149 0 0012 1zm-.69 1.525a9.648 9.648 0 011.38 0c.055.004.135.05.162.16l.351 1.45c.153.628.626 1.08 1.173 1.278.205.074.405.157.6.249a1.832 1.832 0 001.733-.074l1.275-.776c.097-.06.186-.036.228 0 .348.302.674.628.976.976.036.042.06.13 0 .228l-.776 1.274a1.832 1.832 0 00-.074 1.734c.092.195.175.395.248.6.198.547.652 1.02 1.278 1.172l1.45.353c.111.026.157.106.161.161a9.653 9.653 0 010 1.38c-.004.055-.05.135-.16.162l-1.45.351a1.833 1.833 0 00-1.278 1.173 6.926 6.926 0 01-.25.6 1.832 1.832 0 00.075 1.733l.776 1.275c.06.097.036.186 0 .228a9.555 9.555 0 01-.976.976c-.042.036-.13.06-.228 0l-1.275-.776a1.832 1.832 0 00-1.733-.074 6.926 6.926 0 01-.6.248 1.833 1.833 0 00-1.172 1.278l-.353 1.45c-.026.111-.106.157-.161.161a9.653 9.653 0 01-1.38 0c-.055-.004-.135-.05-.162-.16l-.351-1.45a1.833 1.833 0 00-1.173-1.278 6.928 6.928 0 01-.6-.25 1.832 1.832 0 00-1.734.075l-1.274.776c-.097.06-.186.036-.228 0a9.56 9.56 0 01-.976-.976c-.036-.042-.06-.13 0-.228l.776-1.275a1.832 1.832 0 00.074-1.733 6.948 6.948 0 01-.249-.6 1.833 1.833 0 00-1.277-1.172l-1.45-.353c-.111-.026-.157-.106-.161-.161a9.648 9.648 0 010-1.38c.004-.055.05-.135.16-.162l1.45-.351a1.833 1.833 0 001.278-1.173 6.95 6.95 0 01.249-.6 1.832 1.832 0 00-.074-1.734l-.776-1.274c-.06-.097-.036-.186 0-.228.302-.348.628-.674.976-.976.042-.036.13-.06.228 0l1.274.776a1.832 1.832 0 001.734.074 6.95 6.95 0 01.6-.249 1.833 1.833 0 001.172-1.277l.353-1.45c.026-.111.106-.157.161-.161z"/></svg>
  `,
  'unmark': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
        <line x1="2" y1="20" x2="22" y2="4"></line>
      </svg>`,
  'chains': `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="clip1">
      <path d="M 30 50 A 20 20 0 1 1 70 50 A 20 20 0 1 1 30 50 Z"/>
    </clipPath>
    <clipPath id="clip2">
      <path d="M 50 50 A 20 20 0 1 1 90 50 A 20 20 0 1 1 50 50 Z"/>
    </clipPath>
  </defs>

  <circle cx="50" cy="50" r="20" stroke="black" stroke-width="5" fill="none" clip-path="url(#clip1)"/>
  <circle cx="70" cy="50" r="20" stroke="black" stroke-width="5" fill="none" clip-path="url(#clip2)"/>
</svg>
      `,
  'link': `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/>
</svg>
      `,
  'unlink': `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07"/>
</svg>`,
  'next': `
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
`,
  'previous': `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>

             `,
  'crown': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<g stroke-width="0"></g><g  stroke-linecap="round" stroke-linejoin="round"></g><g > <path d="M21.609 13.5616L21.8382 11.1263C22.0182 9.2137 22.1082 8.25739 21.781 7.86207C21.604 7.64823 21.3633 7.5172 21.106 7.4946C20.6303 7.45282 20.0329 8.1329 18.8381 9.49307C18.2202 10.1965 17.9113 10.5482 17.5666 10.6027C17.3757 10.6328 17.1811 10.6018 17.0047 10.5131C16.6865 10.3529 16.4743 9.91812 16.0499 9.04851L13.8131 4.46485C13.0112 2.82162 12.6102 2 12 2C11.3898 2 10.9888 2.82162 10.1869 4.46486L7.95007 9.04852C7.5257 9.91812 7.31351 10.3529 6.99526 10.5131C6.81892 10.6018 6.62434 10.6328 6.43337 10.6027C6.08872 10.5482 5.77977 10.1965 5.16187 9.49307C3.96708 8.1329 3.36968 7.45282 2.89399 7.4946C2.63666 7.5172 2.39598 7.64823 2.21899 7.86207C1.8918 8.25739 1.9818 9.2137 2.16181 11.1263L2.391 13.5616C2.76865 17.5742 2.95748 19.5805 4.14009 20.7902C5.32271 22 7.09517 22 10.6401 22H13.3599C16.9048 22 18.6773 22 19.8599 20.7902C21.0425 19.5805 21.2313 17.5742 21.609 13.5616Z" stroke="currentColor" stroke-width="1.5"></path> <path d="M11.1459 12.5225C11.5259 11.8408 11.7159 11.5 12 11.5C12.2841 11.5 12.4741 11.8408 12.8541 12.5225L12.9524 12.6989C13.0603 12.8926 13.1143 12.9894 13.1985 13.0533C13.2827 13.1172 13.3875 13.141 13.5972 13.1884L13.7881 13.2316C14.526 13.3986 14.895 13.482 14.9828 13.7643C15.0706 14.0466 14.819 14.3407 14.316 14.929L14.1858 15.0812C14.0429 15.2483 13.9714 15.3319 13.9392 15.4353C13.9071 15.5387 13.9179 15.6502 13.9395 15.8733L13.9592 16.0763C14.0352 16.8612 14.0733 17.2536 13.8435 17.4281C13.6136 17.6025 13.2682 17.4435 12.5773 17.1254L12.3986 17.0431C12.2022 16.9527 12.1041 16.9075 12 16.9075C11.8959 16.9075 11.7978 16.9527 11.6014 17.0431L11.4227 17.1254C10.7318 17.4435 10.3864 17.6025 10.1565 17.4281C9.92674 17.2536 9.96476 16.8612 10.0408 16.0763L10.0605 15.8733C10.0821 15.6502 10.0929 15.5387 10.0608 15.4353C10.0286 15.3319 9.95713 15.2483 9.81418 15.0812L9.68403 14.929C9.18097 14.3407 8.92945 14.0466 9.01723 13.7643C9.10501 13.482 9.47396 13.3986 10.2119 13.2316L10.4028 13.1884C10.6125 13.141 10.7173 13.1172 10.8015 13.0533C10.8857 12.9894 10.9397 12.8926 11.0476 12.6989L11.1459 12.5225Z" stroke="currentColor" stroke-width="1.5"></path> </g></svg>
`,
  'magic-wand': `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
              stroke="currentColor" ><path d="m11 4-.5-1-.5 1-1 .125.834.708L9.5 6l1-.666 1 .666-.334-1.167.834-.708zm8.334 10.666L18.5 13l-.834 1.666-1.666.209 1.389 1.181L16.834 18l1.666-1.111L20.166 18l-.555-1.944L21 14.875zM6.667 6.333 6 5l-.667 1.333L4 6.5l1.111.944L4.667 9 6 8.111 7.333 9l-.444-1.556L8 6.5zM3.414 17c0 .534.208 1.036.586 1.414L5.586 20c.378.378.88.586 1.414.586s1.036-.208 1.414-.586L20 8.414c.378-.378.586-.88.586-1.414S20.378 5.964 20 5.586L18.414 4c-.756-.756-2.072-.756-2.828 0L4 15.586c-.378.378-.586.88-.586 1.414zM17 5.414 18.586 7 15 10.586 13.414 9 17 5.414z"/></svg>`,
  'clipboard-check': `
              <svg viewBox="-64 0 512 512"  fill="currentColor" 
            stroke-width="2"  xmlns="http://www.w3.org/2000/svg"><path d="M336 64h-80c0-35.3-28.7-64-64-64s-64 28.7-64 64H48C21.5 64 0 85.5 0 112v352c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48V112c0-26.5-21.5-48-48-48zM192 40c13.3 0 24 10.7 24 24s-10.7 24-24 24-24-10.7-24-24 10.7-24 24-24zm121.2 231.8l-143 141.8c-4.7 4.7-12.3 4.6-17-.1l-82.6-83.3c-4.7-4.7-4.6-12.3.1-17L99.1 285c4.7-4.7 12.3-4.6 17 .1l46 46.4 106-105.2c4.7-4.7 12.3-4.6 17 .1l28.2 28.4c4.7 4.8 4.6 12.3-.1 17z"/></svg>
              `,
  'ungroup': `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                                stroke-width="1.5" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round"
                                                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                                            </svg>
                                            `,
  'random': `
<svg fill="currentColor" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <g id="SVGRepo_bgCarrier" stroke-width="0">
  </g>
  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round">
  </g><g id="SVGRepo_iconCarrier">
  <title>perspective-dice-random</title>
   <path d="M15.676 17.312h0.048c-0.114-0.273-0.263-0.539-0.436-0.78l-11.114-6.346c-0.37 0.13-0.607 0.519-0.607 1.109v9.84c0 1.034 0.726 2.291 1.621 2.808l9.168 5.294c0.544 0.314 1.026 0.282 1.32-0.023v-11.902h-0zM10.049 24.234l-1.83-1.057v-1.918l1.83 1.057v1.918zM11.605 19.993c-0.132 0.2-0.357 0.369-0.674 0.505l-0.324 0.12c-0.23 0.090-0.38 0.183-0.451 0.278-0.071 0.092-0.106 0.219-0.106 0.38v0.242l-1.83-1.056v-0.264c0-0.294 0.056-0.523 0.167-0.685 0.111-0.165 0.346-0.321 0.705-0.466l0.324-0.125c0.193-0.076 0.333-0.171 0.421-0.285 0.091-0.113 0.137-0.251 0.137-0.417 0-0.251-0.081-0.494-0.243-0.728-0.162-0.237-0.389-0.44-0.679-0.608-0.274-0.158-0.569-0.268-0.887-0.329-0.318-0.065-0.649-0.078-0.994-0.040v-1.691c0.409 0.085 0.782 0.19 1.12 0.313s0.664 0.276 0.978 0.457c0.825 0.476 1.453 1.019 1.886 1.627 0.433 0.605 0.649 1.251 0.649 1.937 0 0.352-0.066 0.63-0.198 0.834zM27.111 8.247l-9.531-5.514c-0.895-0.518-2.346-0.518-3.241 0l-9.531 5.514c-0.763 0.442-0.875 1.117-0.336 1.628l10.578 6.040c0.583 0.146 1.25 0.145 1.832-0.003l10.589-6.060c0.512-0.508 0.392-1.17-0.36-1.605zM16.305 10.417l-0.23-0.129c-0.257-0.144-0.421-0.307-0.492-0.488-0.074-0.183-0.062-0.474 0.037-0.874l0.095-0.359c0.055-0.214 0.061-0.389 0.016-0.525-0.041-0.139-0.133-0.248-0.277-0.329-0.219-0.123-0.482-0.167-0.788-0.133-0.309 0.033-0.628 0.141-0.958 0.326-0.31 0.174-0.592 0.391-0.846 0.653-0.257 0.26-0.477 0.557-0.661 0.892l-1.476-0.827c0.332-0.333 0.658-0.625 0.978-0.875s0.659-0.474 1.015-0.674c0.934-0.524 1.803-0.835 2.607-0.934 0.8-0.101 1.5 0.016 2.098 0.352 0.307 0.172 0.508 0.368 0.603 0.589 0.092 0.219 0.097 0.507 0.016 0.865l-0.1 0.356c-0.066 0.255-0.080 0.438-0.041 0.55 0.035 0.11 0.124 0.205 0.265 0.284l0.212 0.118-2.074 1.162zM18.674 11.744l-1.673-0.937 2.074-1.162 1.673 0.937-2.074 1.162zM27.747 10.174l-11.060 6.329c-0.183 0.25-0.34 0.527-0.459 0.813v11.84c0.287 0.358 0.793 0.414 1.37 0.081l9.168-5.294c0.895-0.517 1.621-1.774 1.621-2.808v-9.84c0-0.608-0.251-1.003-0.641-1.121zM23.147 23.68l-1.83 1.056v-1.918l1.83-1.057v1.918zM24.703 17.643c-0.132 0.353-0.357 0.78-0.674 1.284l-0.324 0.494c-0.23 0.355-0.38 0.622-0.451 0.799-0.071 0.174-0.106 0.342-0.106 0.503v0.242l-1.83 1.056v-0.264c0-0.294 0.056-0.587 0.167-0.878 0.111-0.294 0.346-0.721 0.705-1.279l0.324-0.5c0.193-0.298 0.333-0.555 0.421-0.771 0.091-0.218 0.137-0.409 0.137-0.575 0-0.251-0.081-0.4-0.243-0.447-0.162-0.050-0.389 0.009-0.679 0.177-0.274 0.158-0.569 0.39-0.887 0.695-0.318 0.302-0.649 0.671-0.994 1.107v-1.692c0.409-0.387 0.782-0.714 1.12-0.981s0.664-0.491 0.978-0.673c0.825-0.476 1.453-0.659 1.886-0.55 0.433 0.106 0.649 0.502 0.649 1.188 0 0.352-0.066 0.706-0.198 1.062z"></path> </g></svg>
`,
  'calc': `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Main calculator body -->
  <rect x="4" y="2" width="16" height="20" rx="3" stroke="currentColor" stroke-width="2"/>
  
  <!-- Display screen -->
  <rect x="7" y="5" width="10" height="5" rx="1" stroke="currentColor" stroke-width="2"/>
  
  <!-- Buttons -->
  <rect x="7" y="12" width="2" height="2" fill="currentColor"/>
  <rect x="11" y="12" width="2" height="2" fill="currentColor"/>
  <rect x="15" y="12" width="2" height="2" fill="currentColor"/>
  <rect x="7" y="16" width="2" height="2" fill="currentColor"/>
  <rect x="11" y="16" width="2" height="2" fill="currentColor"/>
  <rect x="15" y="16" width="2" height="2" fill="currentColor"/>
</svg>
`,
  'task': `
<svg fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 470.767 470.767" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M362.965,21.384H289.62L286.638,7.99C285.614,3.323,281.467,0,276.685,0h-82.618c-4.782,0-8.913,3.323-9.953,7.99 l-2.967,13.394h-73.36c-26.835,0-48.654,21.827-48.654,48.662v352.06c0,26.835,21.819,48.662,48.654,48.662h255.179 c26.835,0,48.67-21.827,48.67-48.662V70.046C411.635,43.211,389.8,21.384,362.965,21.384z M379.831,422.105 c0,9.295-7.563,16.858-16.866,16.858H107.786c-9.287,0-16.85-7.563-16.85-16.858V70.046c0-9.295,7.563-16.857,16.85-16.857h66.294 l-1.692,7.609c-0.684,3.02,0.062,6.188,1.988,8.596c1.94,2.415,4.876,3.82,7.965,3.82h106.082c3.091,0,6.026-1.405,7.951-3.82 c1.942-2.415,2.687-5.575,2.004-8.596l-1.692-7.609h66.279c9.303,0,16.866,7.563,16.866,16.857V422.105z"></path> <path d="M170.835,188.426h43.249l-10.279-7.019c-14.506-9.899-18.232-29.693-8.325-44.197c9.893-14.489,29.693-18.239,44.197-8.324 l1.694,1.157v-12.136c0-7.866-6.383-14.248-14.242-14.248h-56.294c-7.857,0-14.24,6.383-14.24,14.248v56.271 C156.595,182.045,162.978,188.426,170.835,188.426z"></path> <path d="M303.256,110.313l-49.85,47.194l-22.704-15.49c-7.221-4.962-17.13-3.083-22.099,4.162 c-4.954,7.251-3.09,17.144,4.178,22.098l33.28,22.727c2.718,1.864,5.839,2.772,8.961,2.772c3.96,0,7.888-1.474,10.933-4.356 l59.167-56.014c6.382-6.033,6.645-16.104,0.62-22.479C319.686,104.552,309.637,104.28,303.256,110.313z"></path> <path d="M170.835,297.669H214.1l-10.295-7.027c-14.506-9.901-18.232-29.693-8.325-44.197c9.893-14.498,29.693-18.248,44.197-8.325 l1.694,1.158v-12.136c0-7.865-6.383-14.248-14.242-14.248h-56.294c-7.857,0-14.24,6.383-14.24,14.248v56.279 C156.595,291.286,162.978,297.669,170.835,297.669z"></path> <path d="M303.256,219.555l-49.85,47.186l-22.704-15.49c-7.221-4.97-17.13-3.098-22.099,4.162 c-4.954,7.253-3.09,17.144,4.178,22.099l33.28,22.727c2.718,1.864,5.839,2.772,8.961,2.772c3.96,0,7.888-1.476,10.933-4.356 l59.167-56.007c6.382-6.033,6.645-16.096,0.62-22.479C319.686,213.793,309.637,213.529,303.256,219.555z"></path> <path d="M227.129,322.135h-56.294c-7.857,0-14.24,6.383-14.24,14.248v56.271c0,7.865,6.383,14.248,14.24,14.248h56.294 c7.859,0,14.242-6.383,14.242-14.248v-56.271C241.371,328.518,234.988,322.135,227.129,322.135z"></path> </g> </g></svg>
`,
  'compare':
    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h18m-7.5-9L21 7.5m0 0L16.5 3M21 7.5H3" />
</svg>
`,
  'arrow-up': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
</svg>`,
  'arrow-down': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
</svg>`,
  'right-arrow': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
</svg>`,
  'left-arrow': `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
</svg>`,
  'target': `
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 24 24" 
  fill="none" 
  stroke="currentColor" 
  stroke-width="2" 
  stroke-linecap="round" 
  stroke-linejoin="round"
>
  <!-- The main circle -->
  <circle cx="12" cy="12" r="10"></circle>
  <circle cx="12" cy="12" r="1"></circle>
  <!-- The crosshair lines extending to the edges of the circle -->
  <line x1="24" y1="12" x2="17" y2="12"></line>
  <line x1="0" y1="12" x2="7" y2="12"></line>
  <line x1="12" y1="0" x2="12" y2="8"></line>
  <line x1="12" y1="16" x2="12" y2="24"></line>
</svg>
`,
'hourglass':`
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 416.4 416.4" xml:space="preserve"
  fill="none" 
  stroke="currentColor" 
  stroke-linecap="round" 
  stroke-linejoin="round"
   >
<g>
	<g>
		<g>
			<path fill="currentColor" stroke-width="5"  d="M328.2,352.4h-6l-22-79.2c-8.4-29.6-30.8-52.4-60-60.8v-7.2c28.8-8.4,51.6-31.6,60-61.2l22-80l10-0.4c0.8,0,1.2,0,2-0.4
				C345,60,351.8,50.8,351.8,40V24c0-13.2-10.8-24-24-24H88.2c-13.2,0-24,10.8-24,24v16c0,13.2,10.8,24,24,24h6l22,80.4
				c8.4,29.6,31.2,52.4,60,60.8v6.8c-28.8,8.8-51.6,31.6-60,60.8l-22,79.6h-6c-0.4,0-0.4,0-0.8,0l-4,0.4c-0.4,0-0.8,0-1.6,0.4
				c-10.8,3.2-17.6,12.4-17.6,23.2v16c0,13.2,10.8,24,24,24h240c13.2,0,24-10.8,24-24v-16C352.2,363.2,341.4,352.4,328.2,352.4z
				 M131.4,277.2c6.4-22.4,23.2-40.4,44.8-48.4v11.6c0,4.4,3.6,8,8,8c4.4,0,8-3.6,8-8V218v-19.2v-14.4c0-4.4-3.6-8-8-8
				c-4.4,0-8,3.6-8,8v4c-21.6-7.6-38-25.6-44.8-48.4l-20.8-75.6h121.6c4.4,0,8-3.6,8-8s-3.6-8-8-8h-144c-4.4,0-8-3.6-8-8v-16
				c0-4.4,3.6-8,8-8h240c4.4,0,8,3.6,8,8v16c0,4-2.8,6.4-5.6,7.6l-14.4,0.4c-3.6,0-6.4,2.4-7.6,6L285,140
				c-6.4,22.4-23.2,40.4-44.8,48v-15.6c0-4.4-3.6-8-8-8c-4.4,0-8,3.6-8,8v52c0,4.4,3.6,8,8,8c2.8,0,5.6-1.6,6.8-4
				c22.4,7.6,39.2,25.6,46,48.8l20.8,75.2H110.6L131.4,277.2z M336.2,392.4c0,4.4-3.6,8-8,8h-240c-4.4,0-8-3.6-8-8v-16
				c0-4,2.8-6.8,5.6-7.6l2.8-0.4h11.6h216h12c4.4,0,8,3.6,8,8V392.4z"/>
			<path d="M268.2,64.4h12c4.4,0,8-3.6,8-8s-3.6-8-8-8h-12c-4.4,0-8,3.6-8,8S263.8,64.4,268.2,64.4z"/>
		</g>
	</g>
</g>
</svg>
`,'color': `
<svg fill="currentColor"  version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <path d="M491.124,328.439c-10.233-17.742-28.904-27.917-51.222-27.917c-23.642,0-44.048-15.853-47.467-36.875 c-2.178-13.394,1.372-26.356,9.997-36.497c8.471-9.96,20.826-15.672,33.898-15.672c24.545,0,44.564-10.327,54.924-28.333 c9.795-17.025,9.639-38.337-0.407-55.617C445.136,48.867,360.274,0,269.38,0c-61.683,0-118.886,20.734-165.427,59.962 c-44.305,37.343-74.709,88.804-85.609,144.903c-14.896,76.663,4.627,154.677,53.563,214.037 C120.683,478.067,192.656,512,269.374,512c91.108,0,176.073-49.044,221.739-127.993 C501.016,366.89,501.02,345.598,491.124,328.439z M85.722,256c0-27.618,22.469-50.087,50.087-50.087 c27.618,0,50.087,22.469,50.087,50.087c0,27.618-22.469,50.087-50.087,50.087C108.191,306.087,85.722,283.618,85.722,256z M245.968,396.714c-9.266,16.049-26.139,25.033-43.461,25.033c-8.493,0-17.091-2.158-24.96-6.702 c-11.587-6.689-19.873-17.49-23.337-30.413c-3.463-12.922-1.685-26.42,5.004-38.007c6.689-11.586,17.489-19.873,30.413-23.336 c12.922-3.462,26.42-1.685,38.006,5.004C251.552,342.103,259.776,372.796,245.968,396.714z M227.635,183.706 c-7.717,4.456-16.283,6.732-24.962,6.733c-4.351,0-8.73-0.572-13.045-1.729c-12.922-3.463-23.723-11.75-30.413-23.337 s-8.467-25.085-5.004-38.007c3.463-12.922,11.75-23.723,23.337-30.413c11.587-6.69,25.086-8.467,38.007-5.004 c12.922,3.463,23.723,11.75,30.414,23.337C259.776,139.204,251.552,169.897,227.635,183.706z M292.78,115.286 c6.689-11.586,17.489-19.873,30.413-23.336c12.924-3.462,26.42-1.685,38.006,5.004c23.918,13.808,32.141,44.502,18.334,68.42 c-6.689,11.587-17.49,19.873-30.413,23.337c-4.314,1.156-8.695,1.729-13.045,1.729c-8.68,0-17.244-2.276-24.962-6.733 c-11.586-6.689-19.873-17.49-23.336-30.413C284.313,140.369,286.091,126.871,292.78,115.286z M361.2,415.047 c-7.867,4.542-16.469,6.701-24.959,6.701c-17.325,0-34.194-8.982-43.46-25.033c-6.689-11.587-8.467-25.085-5.004-38.007 c3.463-12.922,11.75-23.723,23.337-30.413c11.587-6.69,25.086-8.468,38.007-5.004c12.922,3.463,23.723,11.75,30.414,23.337 C393.342,370.546,385.117,401.239,361.2,415.047z"></path> </g> </g> </g></svg>
  `,
  'category':`
  <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>category-list</title> <g id="Layer_2" data-name="Layer 2"> <g id="invisible_box" data-name="invisible box"> <rect width="48" height="48" fill="none"></rect> </g> <g id="icons_Q2" data-name="icons Q2"> <path d="M24,10h0a2,2,0,0,1,2-2H42a2,2,0,0,1,2,2h0a2,2,0,0,1-2,2H26A2,2,0,0,1,24,10Z"></path> <path d="M24,24h0a2,2,0,0,1,2-2H42a2,2,0,0,1,2,2h0a2,2,0,0,1-2,2H26A2,2,0,0,1,24,24Z"></path> <path d="M24,38h0a2,2,0,0,1,2-2H42a2,2,0,0,1,2,2h0a2,2,0,0,1-2,2H26A2,2,0,0,1,24,38Z"></path> <path d="M12,7.9,14.4,12H9.5L12,7.9M12,2a2.1,2.1,0,0,0-1.7,1L4.2,13a2.3,2.3,0,0,0,0,2,1.9,1.9,0,0,0,1.7,1H18a2.1,2.1,0,0,0,1.7-1,1.8,1.8,0,0,0,0-2l-6-10A1.9,1.9,0,0,0,12,2Z"></path> <path d="M12,30a6,6,0,1,1,6-6A6,6,0,0,1,12,30Zm0-8a2,2,0,1,0,2,2A2,2,0,0,0,12,22Z"></path> <path d="M16,44H8a2,2,0,0,1-2-2V34a2,2,0,0,1,2-2h8a2,2,0,0,1,2,2v8A2,2,0,0,1,16,44Zm-6-4h4V36H10Z"></path> </g> </g> </g></svg>
  `
};