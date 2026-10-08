// Map colors. A choropleth compares every color with every other, so only three
// categorical hues are used (validated all-pairs against the dark globe surface,
// see the dataviz palette). Every other #1 item folds into "Other".
export const SERIES = ['#3987e5', '#d95926', '#199e70'] as const
export const OTHER = '#7a7a76'
export const NO_DATA = 'rgba(255, 255, 255, 0.07)'
