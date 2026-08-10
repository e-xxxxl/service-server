// data/nigeriaLocations.js
//
// Canonical Nigerian states + LGA/city dataset. This is the single source of
// truth for location data across the platform: ServiceProvider validation,
// search filtering, and the /api/locations endpoints the frontend reads from.
// Do not maintain a second copy of this data anywhere else.
const NIGERIA_LOCATIONS = {
  'Lagos': ['Ikeja', 'Lekki', 'Victoria Island', 'Surulere', 'Yaba', 'Ikoyi', 'Ajah', 'Apapa', 'Badagry', 'Epe', 'Ikorodu', 'Oshodi', 'Agege', 'Alimosho', 'Kosofe', 'Mushin', 'Ojo', 'Shomolu'],
  'Abuja (FCT)': ['Wuse II', 'Garki', 'Maitama', 'Asokoro', 'Gwarinpa', 'Jabi', 'Kubwa', 'Lugbe', 'Gwagwalada', 'Kuje', 'Bwari', 'Karu'],
  'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Eleme', 'Oyigbo', 'Okrika', 'Bonny', 'Degema', 'Ahoada'],
  'Oyo': ['Ibadan North', 'Ibadan South', 'Ogbomosho', 'Oyo', 'Iseyin', 'Saki', 'Eruwa', 'Kisi'],
  'Kano': ['Kano Municipal', 'Nassarawa', 'Tarauni', 'Fagge', 'Dala', 'Gwale', 'Kumbotso', 'Ungogo'],
  'Delta': ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor', 'Ogwashi-Uku', 'Kwale', 'Oleh'],
  'Edo': ['Benin City', 'Ekpoma', 'Auchi', 'Uromi', 'Igarra', 'Abudu', 'Igueben'],
  'Enugu': ['Enugu North', 'Enugu South', 'Nsukka', 'Agbani', 'Awgu', 'Oji River', 'Udi'],
  'Kaduna': ['Kaduna North', 'Kaduna South', 'Zaria', 'Kafanchan', 'Saminaka', 'Kachia'],
  'Abia': ['Umuahia', 'Aba', 'Ohafia', 'Bende', 'Isuikwuato'],
  'Adamawa': ['Yola', 'Mubi', 'Numan', 'Ganye', 'Michika'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Etinan'],
  'Anambra': ['Awka', 'Onitsha', 'Nnewi', 'Aguata', 'Ekwulobia'],
  'Bauchi': ['Bauchi', 'Azare', 'Misau', "Jama'are", 'Katagum'],
  'Bayelsa': ['Yenagoa', 'Brass', 'Nembe', 'Sagbama', 'Ogbia'],
  'Benue': ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya'],
  'Borno': ['Maiduguri', 'Biu', 'Bama', 'Damboa', 'Monguno'],
  'Cross River': ['Calabar', 'Ikom', 'Ogoja', 'Ugep', 'Obudu'],
  'Ebonyi': ['Abakaliki', 'Afikpo', 'Onueke', 'Ezzamgbo', 'Ishieke'],
  'Ekiti': ['Ado-Ekiti', 'Ikere-Ekiti', 'Efon-Alaaye', 'Ijero-Ekiti', 'Emure-Ekiti'],
  'Gombe': ['Gombe', 'Dukku', 'Kaltungo', 'Billiri', 'Kumo'],
  'Imo': ['Owerri', 'Okigwe', 'Orlu', 'Mbaise', 'Oguta'],
  'Jigawa': ['Dutse', 'Hadejia', 'Kazaure', 'Gumel', 'Ringim'],
  'Katsina': ['Katsina', 'Daura', 'Funtua', 'Malumfashi', 'Kankia'],
  'Kebbi': ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru', 'Koko'],
  'Kogi': ['Lokoja', 'Okene', 'Kabba', 'Idah', 'Ankpa'],
  'Kwara': ['Ilorin', 'Offa', 'Omu-Aran', 'Jebba', 'Lafiagi'],
  'Nasarawa': ['Lafia', 'Keffi', 'Karu', 'Nasarawa', 'Akwanga'],
  'Niger': ['Minna', 'Suleja', 'Bida', 'Kontagora', 'Lapai'],
  'Ogun': ['Abeokuta', 'Ijebu-Ode', 'Sagamu', 'Ilaro', 'Ota'],
  'Ondo': ['Akure', 'Ondo', 'Owo', 'Okitipupa', 'Idanre'],
  'Osun': ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo'],
  'Plateau': ['Jos', 'Bukuru', 'Pankshin', 'Shendam', 'Langtang'],
  'Sokoto': ['Sokoto', 'Tambuwal', 'Gwadabawa', 'Illela', 'Wurno'],
  'Taraba': ['Jalingo', 'Wukari', 'Takum', 'Serti', 'Bali'],
  'Yobe': ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam'],
  'Zamfara': ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Maru', 'Anka'],
};

const NIGERIA_STATES = Object.keys(NIGERIA_LOCATIONS);

function isValidState(state) {
  return NIGERIA_STATES.includes(state);
}

function isValidLga(state, lga) {
  if (!isValidState(state)) return false;
  return NIGERIA_LOCATIONS[state].includes(lga);
}

module.exports = { NIGERIA_LOCATIONS, NIGERIA_STATES, isValidState, isValidLga };
