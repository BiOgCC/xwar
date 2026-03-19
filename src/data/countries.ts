/** 2-letter ISO country code lookup by full name */
export const COUNTRY_ISO: Record<string, string> = {
  // Core
  'United States': 'US', 'Russia': 'RU', 'China': 'CN', 'Germany': 'DE',
  'Brazil': 'BR', 'India': 'IN', 'Nigeria': 'NG', 'Japan': 'JP',
  'United Kingdom': 'GB', 'Turkey': 'TR', 'Canada': 'CA', 'Mexico': 'MX',
  'Cuba': 'CU', 'Bahamas': 'BS',
  // Europe
  'France': 'FR', 'Spain': 'ES', 'Italy': 'IT', 'Poland': 'PL', 'Ukraine': 'UA',
  'Romania': 'RO', 'Netherlands': 'NL', 'Belgium': 'BE', 'Sweden': 'SE', 'Norway': 'NO',
  'Finland': 'FI', 'Denmark': 'DK', 'Austria': 'AT', 'Switzerland': 'CH',
  'Czech Republic': 'CZ', 'Portugal': 'PT', 'Greece': 'GR', 'Hungary': 'HU',
  'Ireland': 'IE', 'Iceland': 'IS', 'Serbia': 'RS', 'Belarus': 'BY', 'Bulgaria': 'BG',
  'Slovakia': 'SK', 'Croatia': 'HR', 'Lithuania': 'LT', 'Latvia': 'LV', 'Estonia': 'EE',
  'Slovenia': 'SI', 'Bosnia and Herzegovina': 'BA', 'Albania': 'AL',
  'North Macedonia': 'MK', 'Montenegro': 'ME', 'Moldova': 'MD',
  // Americas
  'Argentina': 'AR', 'Colombia': 'CO', 'Venezuela': 'VE', 'Peru': 'PE', 'Chile': 'CL',
  'Ecuador': 'EC', 'Bolivia': 'BO', 'Paraguay': 'PY', 'Uruguay': 'UY', 'Guyana': 'GY',
  'Suriname': 'SR', 'Guatemala': 'GT', 'Honduras': 'HN', 'El Salvador': 'SV',
  'Nicaragua': 'NI', 'Costa Rica': 'CR', 'Panama': 'PA', 'Dominican Republic': 'DO',
  'Haiti': 'HT', 'Jamaica': 'JM',
  // Asia
  'South Korea': 'KR', 'North Korea': 'KP', 'Taiwan': 'TW', 'Thailand': 'TH',
  'Vietnam': 'VN', 'Philippines': 'PH', 'Malaysia': 'MY', 'Indonesia': 'ID',
  'Myanmar': 'MM', 'Bangladesh': 'BD', 'Pakistan': 'PK', 'Afghanistan': 'AF',
  'Iraq': 'IQ', 'Iran': 'IR', 'Saudi Arabia': 'SA', 'United Arab Emirates': 'AE',
  'Israel': 'IL', 'Syria': 'SY', 'Jordan': 'JO', 'Lebanon': 'LB', 'Yemen': 'YE',
  'Oman': 'OM', 'Kuwait': 'KW', 'Qatar': 'QA', 'Georgia': 'GE', 'Armenia': 'AM',
  'Azerbaijan': 'AZ', 'Kazakhstan': 'KZ', 'Uzbekistan': 'UZ', 'Turkmenistan': 'TM',
  'Kyrgyzstan': 'KG', 'Tajikistan': 'TJ', 'Mongolia': 'MN', 'Nepal': 'NP',
  'Sri Lanka': 'LK', 'Cambodia': 'KH', 'Laos': 'LA',
  // Africa
  'South Africa': 'ZA', 'Egypt': 'EG', 'Kenya': 'KE', 'Ethiopia': 'ET',
  'Tanzania': 'TZ', 'Ghana': 'GH', 'Ivory Coast': 'CI', 'Cameroon': 'CM',
  'Angola': 'AO', 'Mozambique': 'MZ', 'Madagascar': 'MG', 'Morocco': 'MA',
  'Algeria': 'DZ', 'Tunisia': 'TN', 'Libya': 'LY', 'Sudan': 'SD', 'South Sudan': 'SS',
  'Uganda': 'UG', 'Senegal': 'SN', 'Mali': 'ML', 'Burkina Faso': 'BF', 'Niger': 'NE',
  'Chad': 'TD', 'DR Congo': 'CD', 'Congo': 'CG', 'Central African Republic': 'CF',
  'Gabon': 'GA', 'Equatorial Guinea': 'GQ', 'Malawi': 'MW', 'Zambia': 'ZM',
  'Zimbabwe': 'ZW', 'Botswana': 'BW', 'Namibia': 'NA', 'Somalia': 'SO', 'Eritrea': 'ER',
  'Mauritania': 'MR',
  // Oceania
  'Australia': 'AU', 'New Zealand': 'NZ', 'Papua New Guinea': 'PG',
}
