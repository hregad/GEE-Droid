document.addEventListener('DOMContentLoaded', () => {
    const analysisTypeSelect = document.getElementById('analysisType');
    const parametersSection = document.getElementById('parametersSection');
    const scriptOutputSection = document.getElementById('scriptOutputSection');
    const specificParamsDiv = document.getElementById('specificParams');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const targetMonthSelect = document.getElementById('targetMonth');
    const aoiInput = document.getElementById('aoiInput');
    const satelliteSourceSelect = document.getElementById('satelliteSource');
    const geeScriptOutput = document.getElementById('geeScriptOutput');
    const copyScriptButton = document.getElementById('copyScriptButton');
    const clearMapButton = document.getElementById('clearMapButton');

    // Droid status elements
    const droidStatus = document.getElementById('droidStatus');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.getElementById('progressBar');

    // --- Map Initialization ---
    let map = L.map('map').setView([46.603354, 1.888334], 6); // Centered on France
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
    }).addTo(map);

    // FeatureGroup to store drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize Leaflet Draw
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems,
            edit: true,
            remove: true
        },
        draw: {
            polyline: false,
            polygon: {
                allowIntersection: false,
                showArea: true
            },
            rectangle: {
                showArea: true
            },
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    // Event handlers for drawing
    map.on(L.Draw.Event.CREATED, (event) => {
        const layer = event.layer;
        drawnItems.clearLayers(); // Only allow one AOI at a time
        drawnItems.addLayer(layer);
        updateAoiInput(layer.toGeoJSON());
        generateScript();
    });

    map.on(L.Draw.Event.EDITED, (event) => {
        const layers = event.layers;
        layers.eachLayer((layer) => {
            updateAoiInput(layer.toGeoJSON());
        });
        generateScript();
    });

    map.on(L.Draw.Event.DELETED, () => {
        aoiInput.value = '';
        generateScript();
    });

    clearMapButton.addEventListener('click', () => {
        drawnItems.clearLayers();
        aoiInput.value = '';
        generateScript();
        updateDroidStatus("Tracé cartographique effacé. Attente de nouvelles coordonnées.", 0);
    });

    // Update AOI input when GeoJSON is pasted manually (and no drawing is active)
    aoiInput.addEventListener('input', () => {
        if (aoiInput.value.trim() !== '') {
            drawnItems.clearLayers();
            updateDroidStatus("GeoJSON détecté. Vérification de la syntaxe...", 50);
        } else {
             updateDroidStatus("Champ GeoJSON vide. Prêt pour le tracé ou la saisie.", 0);
        }
        generateScript();
    });

    // --- End Map Initialization ---


    // Set default dates (e.g., last year)
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    startDateInput.value = oneYearAgo.toISOString().split('T')[0];
    endDateInput.value = today.toISOString().split('T')[0];

    // Event listener for analysis type selection
    analysisTypeSelect.addEventListener('change', () => {
        const selectedAnalysis = analysisTypeSelect.value;
        if (selectedAnalysis) {
            parametersSection.style.display = 'block';
            scriptOutputSection.style.display = 'block';
            updateSpecificParams(selectedAnalysis);
            updateDroidStatus(`Analyse "${analysisTypeSelect.options[analysisTypeSelect.selectedIndex].text}" sélectionnée. Réglage des modules.`, 20);
            generateScript();
        } else {
            parametersSection.style.display = 'none';
            scriptOutputSection.style.display = 'none';
            specificParamsDiv.innerHTML = '';
            geeScriptOutput.value = '';
            updateDroidStatus("GEE-Droid : En attente de commande.", 0);
        }
    });

    // Event listeners for common parameters to trigger script generation
    [startDateInput, endDateInput, targetMonthSelect, satelliteSourceSelect].forEach(input => {
        input.addEventListener('input', () => {
            updateDroidStatus("Paramètres ajustés. Recalcul du protocole.", 30);
            generateScript();
        });
    });

    // Function to update AOI input from map drawing
    function updateAoiInput(geoJson) {
        aoiInput.value = JSON.stringify(geoJson);
        updateDroidStatus("Zone d'Intérêt (AOI) capturée. Préparation du script.", 60);
    }

    // Function to dynamically update specific parameters based on analysis type
    function updateSpecificParams(analysis) {
        specificParamsDiv.innerHTML = ''; // Clear previous specific parameters
        let htmlContent = '';

        if (analysis === 'desertification') {
            htmlContent = `
                <div class="input-group">
                    <label for="desertIndexType">Indice de dégradation à évaluer :</label>
                    <select id="desertIndexType" class="droid-select">
                        <option value="NDVI_Change">Changement de l'Indice de Végétation (NDVI)</option>
                        <option value="Albedo_Change">Changement d'Albédo (Réflectance de surface)</option>
                        <option value="LST_Change">Changement de Température de Surface (LST)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="desertThreshold">Seuil de dégradation (ex: -0.1 pour NDVI) :</label>
                    <input type="number" id="desertThreshold" step="0.01" value="-0.1" class="droid-input">
                </div>
            `;
        } else if (analysis === 'waterStress') {
            htmlContent = `
                <div class="input-group">
                    <label for="waterStressIndex">Indice de stress hydrique :</label>
                    <select id="waterStressIndex" class="droid-select">
                        <option value="NDWI">NDWI (Indice d'Eau Normalisé)</option>
                        <option value="NDMI">NDMI (Indice d'Humidité Normalisé)</option>
                        <option value="LSWI">LSWI (Indice d'Eau de Surface Terrestre)</option>
                        <option value="TCI">TCI (Indice de Condition Thermique - nécessite MODIS)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="waterStressThreshold">Seuil de stress (ex: 0 pour NDWI, -0.2 pour NDMI) :</label>
                    <input type="number" id="waterStressThreshold" step="0.01" value="0" class="droid-input">
                </div>
            `;
        } else if (analysis === 'cropMonitoring') {
            htmlContent = `
                <div class="input-group">
                    <label for="cropVegetationIndex">Indice de végétation pour les cultures :</label>
                    <select id="cropVegetationIndex" class="droid-select">
                        <option value="NDVI">NDVI (Indice de Végétation)</option>
                        <option value="EVI">EVI (Indice de Végétation Amélioré)</option>
                        <option value="GNDVI">GNDVI (Indice de Végétation Vert Normalisé)</option>
                        <option value="SAVI">SAVI (Indice de Végétation Ajusté au Sol)</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="cloudFilter">Couverture nuageuse maximale (%) :</label>
                    <input type="number" id="cloudFilter" min="0" max="100" value="10" class="droid-input">
                    <small class="info-text">Seules les images avec moins de X% de nuages seront utilisées.</small>
                </div>
                <div class="input-group">
                    <label for="generateChart">Générer un graphique d'évolution temporelle :</label>
                    <input type="checkbox" id="generateChart" checked>
                </div>
            `;
        }
        specificParamsDiv.innerHTML = htmlContent;

        // Add event listeners to newly created specific parameters
        specificParamsDiv.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => {
                updateDroidStatus("Paramètres spécifiques calibrés. Mise à jour du script.", 40);
                generateScript();
            });
        });
    }

    // Function to update droid status and progress bar
    function updateDroidStatus(message, progress) {
        droidStatus.textContent = `GEE-Droid : ${message}`;
        if (progress > 0) {
            progressBarContainer.style.display = 'block';
            progressBar.style.width = `${progress}%`;
        } else {
            progressBarContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }
    }


    // Main function to generate the GEE script
    function generateScript() {
        const analysisType = analysisTypeSelect.value;
        if (!analysisType) {
            geeScriptOutput.value = '';
            updateDroidStatus("Aucune analyse sélectionnée. En attente d'instructions.", 0);
            return;
        }

        updateDroidStatus("Traitement en cours... 10%", 10);

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const targetMonth = targetMonthSelect.value;
        let aoi = aoiInput.value.trim();
        const satelliteSource = satelliteSourceSelect.value;
        const cloudFilterPercentage = document.getElementById('cloudFilter')?.value || 10;
        const maxCloudCover = parseFloat(cloudFilterPercentage) / 100;

        try {
            const parsedAoi = JSON.parse(aoi);
            if (!['FeatureCollection', 'Feature', 'Geometry'].includes(parsedAoi.type)) {
                aoi = `// ERREUR: GeoJSON invalide. Veuillez coller un GeoJSON valide ici ou dessiner sur la carte.
var aoi = ee.Geometry.Point([0, 0]); // Point par défaut en cas d'erreur
print('ERREUR: GeoJSON non valide. Veuillez vérifier votre saisie ou le tracé sur la carte.');`;
                updateDroidStatus("Erreur GeoJSON : Format non reconnu. Veuillez corriger.", 100);
            } else {
                aoi = `var aoi = ee.FeatureCollection(${JSON.stringify(parsedAoi)}); // Zone d'Intérêt (AOI) définie par l'utilisateur`;
                if (parsedAoi.type === 'Geometry') {
                     aoi = `var aoi = ee.FeatureCollection([ee.Feature(${JSON.stringify(parsedAoi)})]); // Géométrie convertie en FeatureCollection pour Earth Engine`;
                }
                updateDroidStatus("GeoJSON validé. Initialisation des capteurs.", 20);
            }
        } catch (e) {
            aoi = `// ERREUR: GeoJSON invalide ou mal formaté. Veuillez coller un GeoJSON valide ici ou dessiner sur la carte.
var aoi = ee.Geometry.Point([0, 0]); // Point par défaut en cas d'erreur
print('ERREUR: GeoJSON mal formaté. Détails: ${e.message}');`;
            updateDroidStatus(`Erreur GeoJSON : Problème de formatage. Détails: ${e.message.substring(0, 50)}...`, 100);
        }

        let script = `
// Script Google Earth Engine généré par GEE-Droid
// Date de génération : ${new Date().toLocaleString('fr-FR')}
// Analyse sélectionnée : ${analysisTypeSelect.options[analysisTypeSelect.selectedIndex].text}

// 1. Définir la Zone d'Intérêt (AOI)
${aoi}

// Centrer l'affichage cartographique sur l'AOI
Map.centerObject(aoi, 10); // Ajustez le niveau de zoom si nécessaire

// 2. Définir les dates et le mois cible pour l'analyse
var startDate = ee.Date('${startDate}');
var endDate = ee.Date('${endDate}');
var targetMonth = '${targetMonth}'; // 'all' ou un nombre de 1 à 12

// 3. Fonctions de masquage des nuages pour différentes sources satellite
// Masque pour Sentinel-2 (QA60 et SCL)
function maskS2clouds(image) {
    var qa = image.select('QA60');
    var cloudBitMask = 1 << 10; // Bit 10: Nuages
    var cirrusBitMask = 1 << 11; // Bit 11: Cirrus
    var maskQA = qa.bitwiseAnd(cloudBitMask).eq(0)
        .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

    var scl = image.select('SCL');
    var s2CloudMask = scl.neq(3) // Pixels de zones sombres (Dark Area Pixels)
                      .and(scl.neq(8)) // Probabilité moyenne de nuage
                      .and(scl.neq(9)) // Forte probabilité de nuage
                      .and(scl.neq(10)) // Cirrus
                      .and(scl.neq(11)); // Neige/Glace

    return image.updateMask(maskQA).updateMask(s2CloudMask)
                .copyProperties(image, ['system:time_start', 'system:index', 'CLOUDY_PIXEL_PERCENTAGE']);
}

// Masque pour Landsat 8 (QA_PIXEL)
function maskL8clouds(image) {
    var qa = image.select('QA_PIXEL');
    var cloud = qa.bitwiseAnd(1 << 3) // Bit 3: Nuage
                   .and(qa.bitwiseAnd(1 << 5)).eq(0); // Bit 5: Confiance élevée en le nuage
    var cloudShadow = qa.bitwiseAnd(1 << 4).eq(0); // Bit 4: Ombre de nuage

    return image.updateMask(cloud).updateMask(cloudShadow)
                .copyProperties(image, ['system:time_start', 'system:index', 'CLOUD_COVER']);
}

// Masque pour MODIS Surface Reflectance (State_1km)
function maskModisSR(image) {
  var qa = image.select('State_1km');
  var cloudState = qa.bitwiseAnd(1 << 0).eq(0); // Bit 0: État du nuage (0 = clair)
  var cloudShadowState = qa.bitwiseAnd(1 << 1).eq(0); // Bit 1: État de l'ombre de nuage (0 = clair)
  var cirrusState = qa.bitwiseAnd(1 << 2).eq(0); // Bit 2: État du cirrus (0 = clair)
  var internalCloudAlg = qa.bitwiseAnd(1 << 10).eq(0); // Bit 10: Algorithme interne de nuage (0 = clair)

  return image.updateMask(cloudState.and(cloudShadowState).and(cirrusState).and(internalCloudAlg))
              .copyProperties(image, ['system:time_start', 'system:index']);
}

// 4. Acquisition des images satellite et application des filtres
var collection;
var bands;

if ('${satelliteSource}' === 'S2') {
    collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', ${maxCloudCover * 100}) // Filtrage initial par % de nuages
        .map(maskS2clouds); // Masque de nuages détaillé
    bands = {
        'NDVI': ['B8', 'B4'], // NIR, Red
        'EVI': ['B8', 'B4', 'B2'], // NIR, Red, Blue
        'GNDVI': ['B8', 'B3'], // NIR, Green
        'SAVI': ['B8', 'B4'], // NIR, Red
        'NDWI': ['B3', 'B8'], // Green, NIR
        'NDMI': ['B8', 'B11'] // NIR, SWIR2 (bande SWIR1 est B11 pour S2)
    };
} else if ('${satelliteSource}' === 'L8') {
    collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .filterMetadata('CLOUD_COVER', 'less_than', ${maxCloudCover * 100})
        .map(maskL8clouds)
        .map(function(image) { // Appliquer les facteurs d'échelle pour Landsat 8 Collection 2 (réflectance de surface)
            var opticalBands = image.select('SR_B[1-7]').multiply(0.0000275).add(-0.2);
            var thermalBand = image.select('ST_B10').multiply(0.00341802).add(149.0); // Conversion LST
            return image.addBands(opticalBands, null, true)
                        .addBands(thermalBand, null, true)
                        .copyProperties(image, ['system:time_start', 'system:index', 'CLOUD_COVER']);
        });
    bands = {
        'NDVI': ['SR_B5', 'SR_B4'], // NIR, Red
        'EVI': ['SR_B5', 'SR_B4', 'SR_B2'], // NIR, Red, Blue
        'GNDVI': ['SR_B5', 'SR_B3'], // NIR, Green
        'SAVI': ['SR_B5', 'SR_B4'], // NIR, Red
        'NDWI': ['SR_B3', 'SR_B5'], // Green, NIR
        'NDMI': ['SR_B5', 'SR_B6'] // NIR, SWIR1
    };
} else if ('${satelliteSource}' === 'MODIS') {
    collection = ee.ImageCollection('MODIS/061/MOD09GA') // Réflectance de Surface MODIS
        .filterDate(startDate, endDate)
        .filterBounds(aoi)
        .map(maskModisSR);
    bands = {
        'NDVI': ['sur_refl_b02', 'sur_refl_b01'], // NIR, Red
        'EVI': ['sur_refl_b02', 'sur_refl_b01', 'sur_refl_b03'], // NIR, Red, Blue
        'GNDVI': ['sur_refl_b02', 'sur_refl_b04'] // NIR, Green
        // NDWI, NDMI, SAVI pour MODIS utiliseraient des bandes SWIR spécifiques (ex: sur_refl_b06, sur_refl_b07)
    };
}

if (!collection || collection.size().getInfo() === 0) {
    print('GEE-Droid Alerte : Aucune image satellite disponible après filtrage. Veuillez ajuster la période, l\'AOI ou le filtre nuageux.');
} else {
    print('GEE-Droid Statut : ' + collection.size() + ' images disponibles pour traitement après filtrage atmosphérique.');

    // 5. Création des composites mensuels ou sélection du mois cible
    var monthlyComposites = ee.ImageCollection.fromImages(
        ee.List.sequence(startDate.get('year'), endDate.get('year')).map(function(year) {
            var currentYear = ee.Number(year);
            var monthsToProcess = targetMonth === 'all' ? ee.List.sequence(1, 12) : ee.List([ee.Number(targetMonth)]);

            return monthsToProcess.map(function(month) {
                var startOfMonth = ee.Date.fromYMD(currentYear, month, 1);
                var endOfMonth = startOfMonth.advance(1, 'month');

                // Filtrer la collection pour le mois et l'année en cours
                var monthlyCollection = collection.filterDate(startOfMonth, endOfMonth);

                // Si la collection mensuelle n'est pas vide, prendre la médiane
                return ee.Algorithms.If(monthlyCollection.size().gt(0),
                    monthlyCollection.median() // Utilisation de la médiane pour lisser les variations
                        .set('system:time_start', startOfMonth.millis())
                        .set('year', currentYear)
                        .set('month', month)
                        .set('count', monthlyCollection.size()), // Nombre d'images utilisées pour le composite
                    null // Retourne null si aucune image n'est trouvée pour le mois
                );
            });
        }).flatten()
    ).filter(ee.Filter.notNull(['system:time_start'])); // Supprime les éléments null de la collection

    if (monthlyComposites.size().getInfo() === 0) {
        print('GEE-Droid Alerte : Aucun composite mensuel généré. Vérifiez la période ou le mois cible.');
    } else {
        print('GEE-Droid Statut : ' + monthlyComposites.size() + ' composites mensuels/ciblés créés.');
        var composite = monthlyComposites.median(); // La médiane de tous les composites générés pour une vue globale

`;

        if (analysisType === 'desertification') {
            const desertIndexType = document.getElementById('desertIndexType').value;
            const desertThreshold = document.getElementById('desertThreshold').value;

            script += `
    // 6. Calcul de l'indice de désertification
    var desertIndex;
    var visParams;

    // Pour les analyses de changement, nous utilisons deux composites médians (début et fin de la période globale ou spécifique au mois cible)
    var compositeBefore, compositeAfter;

    if (targetMonth === 'all') {
        var midDate = startDate.advance(endDate.difference(startDate, 'month').divide(2), 'month');
        compositeBefore = monthlyComposites.filterDate(startDate, midDate).median();
        compositeAfter = monthlyComposites.filterDate(midDate, endDate).median();
    } else {
        // Si un mois cible est choisi, comparer les années pour ce mois
        var yearsList = monthlyComposites.aggregate_array('year').distinct();
        if (yearsList.size().lt(2).getInfo()) { // Utiliser .getInfo() pour les opérations côté client
            print('GEE-Droid Avertissement : Pas assez d\'années (moins de 2) pour comparer des changements pour le mois cible. L\'analyse peut être limitée.');
            compositeBefore = monthlyComposites.first(); // Utilise le premier composite disponible comme 'avant'
            compositeAfter = monthlyComposites.sort('system:time_start', false).first(); // Utilise le dernier composite disponible comme 'après'
        } else {
            var firstYear = ee.Number(yearsList.sort().first());
            var lastYear = ee.Number(yearsList.sort().reverse().first());
            compositeBefore = monthlyComposites.filter(ee.Filter.eq('year', firstYear)).median();
            compositeAfter = monthlyComposites.filter(ee.Filter.eq('year', lastYear)).median();
        }
    }

    // Vérifier si les composites existent avant de procéder
    if (compositeBefore && compositeAfter && compositeBefore.getInfo() !== null && compositeAfter.getInfo() !== null) {
        if ('${desertIndexType}' === 'NDVI_Change') {
            var ndviBefore = compositeBefore.normalizedDifference(bands['NDVI']).rename('NDVI_Before');
            var ndviAfter = compositeAfter.normalizedDifference(bands['NDVI']).rename('NDVI_After');
            desertIndex = ndviAfter.subtract(ndviBefore).rename('Changement_NDVI');
            visParams = {min: -0.2, max: 0.2, palette: ['#A52A2A', '#DDA0DD', '#90EE90', '#228B22']}; // Rouge (dégradation) à Vert (amélioration)
            print('GEE-Droid : Calcul du changement de NDVI (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
        } else if ('${desertIndexType}' === 'Albedo_Change') {
            var albedoBands;
            if ('${satelliteSource}' === 'S2') albedoBands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'];
            else if ('${satelliteSource}' === 'L8') albedoBands = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
            else if ('${satelliteSource}' === 'MODIS') albedoBands = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b06', 'sur_refl_b07'];
            else albedoBands = [''];

            if (albedoBands[0]) {
                var albedoBefore = compositeBefore.select(albedoBands).mean().rename('Albedo_Before');
                var albedoAfter = compositeAfter.select(albedoBands).mean().rename('Albedo_After');
                desertIndex = albedoAfter.subtract(albedoBefore).rename('Changement_Albedo');
                visParams = {min: -0.1, max: 0.1, palette: ['#6B8E23', '#F0E68C', '#B22222']}; // Vert (baisse, bon) à Rouge (augmentation, dégradation)
                print('GEE-Droid : Calcul du changement d\'Albédo (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
            } else {
                print('GEE-Droid Erreur : Bandes d\'albédo non disponibles pour la source satellite sélectionnée.');
                desertIndex = ee.Image(0).rename('Changement_Albedo');
            }
        } else if ('${desertIndexType}' === 'LST_Change') {
            // Acquisition des données LST (Température de Surface Terrestre) de MODIS
            var modisLSTCollection = ee.ImageCollection('MODIS/061/MOD11A2')
                .filterDate(startDate, endDate)
                .filterBounds(aoi)
                .select('LST_Day_1km')
                .map(function(image) {
                    return image.multiply(0.02).subtract(273.15).rename('LST_Celsius') // Conversion en Celsius
                                .copyProperties(image, ['system:time_start']);
                });

            var lstYears = modisLSTCollection.aggregate_array('system:time_start')
                .map(function(date) { return ee.Date(date).get('year'); }).distinct();
            var lstMonthsToProcess = targetMonth === 'all' ? ee.List.sequence(1, 12) : ee.List([ee.Number(targetMonth)]);

            var monthlyLSTComposites = ee.ImageCollection.fromImages(
                lstYears.map(function(year) {
                    return lstMonthsToProcess.map(function(month) {
                        var startOfMonth = ee.Date.fromYMD(year, month, 1);
                        var endOfMonth = startOfMonth.advance(1, 'month');
                        var monthlyLSTSubCollection = modisLSTCollection.filterDate(startOfMonth, endOfMonth);
                        return ee.Algorithms.If(monthlyLSTSubCollection.size().gt(0),
                            monthlyLSTSubCollection.median().set('system:time_start', startOfMonth.millis()).set('year', year),
                            null
                        );
                    });
                }).flatten()
            ).filter(ee.Filter.notNull(['system:time_start']));

            var lstBefore, lstAfter;
            if (targetMonth === 'all') {
                var midDateLST = startDate.advance(endDate.difference(startDate, 'month').divide(2), 'month');
                lstBefore = monthlyLSTComposites.filterDate(startDate, midDateLST).median();
                lstAfter = monthlyLSTComposites.filterDate(midDateLST, endDate).median();
            } else {
                 if (lstYears.size().lt(2).getInfo()) {
                    print('GEE-Droid Avertissement : Pas assez d\'années (moins de 2) pour l\'analyse LST pour le mois cible. L\'analyse peut être limitée.');
                    lstBefore = monthlyLSTComposites.first();
                    lstAfter = monthlyLSTComposites.sort('system:time_start', false).first();
                } else {
                    var firstLSTYear = ee.Number(lstYears.sort().first());
                    var lastLSTYear = ee.Number(lstYears.sort().reverse().first());
                    lstBefore = monthlyLSTComposites.filter(ee.Filter.eq('year', firstLSTYear)).median();
                    lstAfter = monthlyLSTComposites.filter(ee.Filter.eq('year', lastLSTYear)).median();
                }
            }

            if (lstBefore && lstAfter && lstBefore.getInfo() !== null && lstAfter.getInfo() !== null) {
                desertIndex = lstAfter.subtract(lstBefore).rename('Changement_LST_Celsius');
                visParams = {min: -3, max: 3, palette: ['#6495ED', '#FFFFFF', '#DC143C']}; // Bleu (refroidissement) à Rouge (réchauffement, dégradation)
                print('GEE-Droid : Calcul du changement de LST (Celsius) via MODIS (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
            } else {
                print('GEE-Droid Erreur : Données MODIS LST insuffisantes pour calculer le changement. Ajustez les dates.');
                desertIndex = ee.Image(0).rename('Changement_LST');
            }
        }

        if (desertIndex && desertIndex.getInfo() !== null) {
            Map.addLayer(desertIndex.clip(aoi), visParams, desertIndex.bandNames().get(0).getInfo());

            // Exportation du TIFF
            Export.image.toDrive({
                image: desertIndex.clip(aoi),
                description: 'Indice_Degradation_GEE_Droid',
                scale: compositeBefore.projection().nominalScale().getInfo(), // Résolution native du composite
                region: aoi.geometry().bounds(),
                maxPixels: 1e13
            });

            // Exportation de la limite de l'AOI en GeoJSON
            Export.table.toDrive({
                collection: aoi.geometry().bounds(),
                description: 'AOI_Limite_GEE_Droid',
                fileFormat: 'GeoJSON'
            });
            print('GEE-Droid : Exportation des résultats vers Google Drive initiée.');
        } else {
            print('GEE-Droid Alerte : Impossible de calculer l\'indice de désertification. Vérifiez les paramètres et les données.');
        }
    } else {
        print('GEE-Droid Alerte : Composites "avant" ou "après" manquants pour le calcul de changement. Ajustez la période ou le mois cible.');
    }
`;
        } else if (analysisType === 'waterStress') {
            const waterStressIndex = document.getElementById('waterStressIndex').value;
            const waterStressThreshold = document.getElementById('waterStressThreshold').value;

            script += `
    // 6. Calcul de l'indice de stress hydrique sur le composite médian
    var waterIndex;
    var visParams;

    if (composite.getInfo() === null) {
        print('GEE-Droid Erreur : Composite médian vide pour l\'analyse du stress hydrique. Vérifiez vos données.');
        waterIndex = ee.Image(0).rename('Stress_Hydrique');
    } else {
        if ('${waterStressIndex}' === 'NDWI') {
            waterIndex = composite.normalizedDifference(bands['NDWI']).rename('NDWI');
            visParams = {min: -1, max: 1, palette: ['#8B4513', '#FFD700', '#98FB98', '#4682B4', '#000080']}; // Brun (sec) à Bleu Foncé (eau)
            print('GEE-Droid : Calcul de l\'indice NDWI (basé sur médiane ${targetMonth === 'all' ? 'annuelle' : 'du mois cible'}).');
        } else if ('${waterStressIndex}' === 'NDMI') {
            waterIndex = composite.normalizedDifference(bands['NDMI']).rename('NDMI');
            visParams = {min: -1, max: 1, palette: ['#A0522D', '#F4A460', '#9ACD32', '#6A5ACD']}; // Marron (sec) à Violet Bleu (humide)
            print('GEE-Droid : Calcul de l\'indice NDMI (basé sur médiane ${targetMonth === 'all' ? 'annuelle' : 'du mois cible'}).');
        } else if ('${waterStressIndex}' === 'LSWI') {
            var nirBand = bands['NDMI'][0];
            var swir1Band;
            if ('${satelliteSource}' === 'S2') swir1Band = 'B11';
            else if ('${satelliteSource}' === 'L8') swir1Band = 'SR_B6';
            else if ('${satelliteSource}' === 'MODIS') swir1Band = 'sur_refl_b06';
            else swir1Band = null;

            if (swir1Band) {
                waterIndex = composite.normalizedDifference([nirBand, swir1Band]).rename('LSWI');
                visParams = {min: -1, max: 1, palette: ['#A0522D', '#F4A460', '#9ACD32', '#6A5ACD']};
                print('GEE-Droid : Calcul de l\'indice LSWI (basé sur médiane ${targetMonth === 'all' ? 'annuelle' : 'du mois cible'}).');
            } else {
                print('GEE-Droid Erreur : Bande SWIR1 non disponible pour LSWI avec la source satellite sélectionnée.');
                waterIndex = ee.Image(0).rename('LSWI');
            }
        } else if ('${waterStressIndex}' === 'TCI') {
            if ('${satelliteSource}' !== 'MODIS') {
                print('GEE-Droid Avertissement : L\'indice TCI est plus précis avec les données de température de surface (MODIS). Proxy utilisé avec les données de réflectance.');
                if (bands['NDMI']) {
                     waterIndex = composite.normalizedDifference(bands['NDMI']).multiply(-1).rename('Proxy_TCI_via_NDMI'); // Inverser NDMI comme proxy
                     visParams = {min: -0.5, max: 0.5, palette: ['#6495ED', '#FFFFFF', '#DC143C']}; // Bleu (moins stress) à Rouge (plus stress)
                     print('GEE-Droid : Calcul de Proxy TCI (via NDMI, basé sur médiane ${targetMonth === 'all' ? 'annuelle' : 'du mois cible'}).');
                } else {
                    print('GEE-Droid Erreur : Bandes NDMI non disponibles pour Proxy TCI.');
                    waterIndex = ee.Image(0).rename('Proxy_TCI');
                }
            } else {
                // Vrai TCI avec MODIS/061/MOD11A2 (basé sur la moyenne mensuelle des LST)
                var modisLSTCollection = ee.ImageCollection('MODIS/061/MOD11A2')
                    .filterDate(startDate, endDate)
                    .filterBounds(aoi)
                    .select('LST_Day_1km')
                    .map(function(image) {
                        return image.multiply(0.02).subtract(273.15).rename('LST_Celsius')
                                    .copyProperties(image, ['system:time_start']);
                    });

                var lstYears = modisLSTCollection.aggregate_array('system:time_start')
                    .map(function(date) { return ee.Date(date).get('year'); }).distinct();
                var lstMonthsToProcess = targetMonth === 'all' ? ee.List.sequence(1, 12) : ee.List([ee.Number(targetMonth)]);

                var monthlyLSTComposites = ee.ImageCollection.fromImages(
                    lstYears.map(function(year) {
                        return lstMonthsToProcess.map(function(month) {
                            var startOfMonth = ee.Date.fromYMD(year, month, 1);
                            var endOfMonth = startOfMonth.advance(1, 'month');
                            var monthlyLSTSubCollection = modisLSTCollection.filterDate(startOfMonth, endOfMonth);
                            return ee.Algorithms.If(monthlyLSTSubCollection.size().gt(0),
                                monthlyLSTSubCollection.median().set('system:time_start', startOfMonth.millis()),
                                null
                            );
                        });
                    }).flatten()
                ).filter(ee.Filter.notNull(['system:time_start']));

                var meanLST = monthlyLSTComposites.mean();
                var minLST = monthlyLSTComposites.min();
                var maxLST = monthlyLSTComposites.max();

                if (meanLST && minLST && maxLST && meanLST.getInfo() !== null && minLST.getInfo() !== null && maxLST.getInfo() !== null) {
                    waterIndex = meanLST.subtract(minLST).divide(maxLST.subtract(minLST)).multiply(100).rename('TCI');
                    visParams = {min: 0, max: 100, palette: ['#6B8E23', '#F0E68C', '#B22222']}; // Vert (pas de stress) à Rouge (stress élevé)
                    print('GEE-Droid : Calcul de l\'indice TCI (Temperature Condition Index) via MODIS (basé sur médianes ${targetMonth === 'all' ? 'annuelles' : 'du mois cible'}).');
                } else {
                    print('GEE-Droid Erreur : Données LST insuffisantes pour TCI. Vérifiez les données MODIS.');
                    waterIndex = ee.Image(0).rename('TCI');
                }
            }
        }

        if (waterIndex && waterIndex.getInfo() !== null) {
            Map.addLayer(waterIndex.clip(aoi), visParams, waterIndex.bandNames().get(0).getInfo());

            // Exportation du TIFF
            Export.image.toDrive({
                image: waterIndex.clip(aoi),
                description: 'Stress_Hydrique_GEE_Droid',
                scale: composite.projection().nominalScale().getInfo(),
                region: aoi.geometry().bounds(),
                maxPixels: 1e13
            });

            // Exportation de la limite de l'AOI en GeoJSON
            Export.table.toDrive({
                collection: aoi.geometry().bounds(),
                description: 'AOI_Limite_GEE_Droid',
                fileFormat: 'GeoJSON'
            });
            print('GEE-Droid : Exportation des résultats vers Google Drive initiée.');
        } else {
            print('GEE-Droid Alerte : Impossible de calculer l\'indice de stress hydrique. Vérifiez les paramètres et les données.');
        }
    }
`;
        } else if (analysisType === 'cropMonitoring') {
            const cropVegetationIndex = document.getElementById('cropVegetationIndex').value;
            const generateChart = document.getElementById('generateChart').checked;

            script += `
    // 6. Calcul de l'indice de végétation pour le suivi des cultures sur chaque composite mensuel (ou mois cible)
    var cropIndexCollection;
    var visParams;

    if (monthlyComposites.size().getInfo() === 0) {
        print('GEE-Droid Erreur : Aucun composite mensuel pour l\'analyse des cultures. Vérifiez les données.');
        cropIndexCollection = ee.ImageCollection([]); // Collection vide
    } else {
        if ('${cropVegetationIndex}' === 'NDVI') {
            cropIndexCollection = monthlyComposites.map(function(image){
                return image.normalizedDifference(bands['NDVI']).rename('NDVI')
                            .copyProperties(image, ['system:time_start', 'year', 'month', 'count']);
            });
            visParams = {min: 0, max: 1, palette: ['#8B4513', '#FFD700', '#9ACD32', '#228B22']}; // Brun (sol nu) à Vert Foncé (végétation dense)
            print('GEE-Droid : Calcul de l\'indice NDVI pour le suivi des cultures (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
        } else if ('${cropVegetationIndex}' === 'EVI') {
            cropIndexCollection = monthlyComposites.map(function(image){
                if (bands['EVI']) {
                    return image.expression(
                        '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                            'NIR': image.select(bands['EVI'][0]),
                            'RED': image.select(bands['EVI'][1]),
                            'BLUE': image.select(bands['EVI'][2])
                        }).rename('EVI')
                        .copyProperties(image, ['system:time_start', 'year', 'month', 'count']);
                } else {
                    return ee.Image(0).rename('EVI').set('system:time_start', image.get('system:time_start'));
                }
            });
            visParams = {min: 0, max: 1, palette: ['#DC143C', '#F4A460', '#9ACD32', '#006400']};
            print('GEE-Droid : Calcul de l\'indice EVI pour le suivi des cultures (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
        } else if ('${cropVegetationIndex}' === 'GNDVI') {
            cropIndexCollection = monthlyComposites.map(function(image){
                return image.normalizedDifference(bands['GNDVI']).rename('GNDVI')
                            .copyProperties(image, ['system:time_start', 'year', 'month', 'count']);
            });
            visParams = {min: 0, max: 1, palette: ['#B22222', '#F0E68C', '#ADFF2F', '#32CD32']};
            print('GEE-Droid : Calcul de l\'indice GNDVI pour le suivi des cultures (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
        } else if ('${cropVegetationIndex}' === 'SAVI') {
            var L_savi = 0.5; // Facteur d'ajustement du sol (typiquement 0.5)
            cropIndexCollection = monthlyComposites.map(function(image){
                if (bands['SAVI']) {
                     return image.expression(
                        '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
                            'NIR': image.select(bands['SAVI'][0]),
                            'RED': image.select(bands['SAVI'][1]),
                            'L': L_savi
                        }).rename('SAVI')
                        .copyProperties(image, ['system:time_start', 'year', 'month', 'count']);
                } else {
                    return ee.Image(0).rename('SAVI').set('system:time_start', image.get('system:time_start'));
                }
            });
            visParams = {min: 0, max: 1, palette: ['#8B4513', '#F4A460', '#6B8E23', '#006400']};
            print('GEE-Droid : Calcul de l\'indice SAVI pour le suivi des cultures (basé sur médianes ${targetMonth === 'all' ? 'mensuelles' : 'du mois cible'}).');
        }

        if (cropIndexCollection.size().getInfo() > 0) {
            var compositeCropIndex = cropIndexCollection.median(); // Composite médian de tous les mois générés pour la visualisation finale
            Map.addLayer(compositeCropIndex.clip(aoi), visParams, 'Santé des cultures (' + '${cropVegetationIndex}' + ')');

            // 7. Génération du graphique d'évolution temporelle
            if (${generateChart}) {
                var chart = ui.Chart.Image.series({
                    imageCollection: cropIndexCollection, // Utilise la collection d'indices mensuels ou ciblés
                    region: aoi.geometry(),
                    reducer: ee.Reducer.mean(),
                    scale: ee.Image(monthlyComposites.first()).projection().nominalScale().getInfo(), // Échelle du premier composite
                    xProperty: 'system:time_start'
                }).setOptions({
                    title: 'GEE-Droid : Évolution du ' + '${cropVegetationIndex}' + '${targetMonth === 'all' ? '' : ' (Mois ' + targetMonth + ')'}',
                    vAxis: {title: '${cropVegetationIndex}'},
                    hAxis: {title: 'Date'},
                    legend: {position: 'none'},
                    lineWidth: 2,
                    pointSize: 4,
                    colors: ['${visParams.palette[visParams.palette.length-1]}'] // Couleur du graphique
                });
                print(chart);
                print('GEE-Droid : Graphique d\'évolution temporelle généré. Veuillez le consulter dans l\'éditeur GEE.');
            }

            // 8. Exportation du TIFF (composite médian global)
            Export.image.toDrive({
                image: compositeCropIndex.clip(aoi),
                description: 'Sante_Culture_${cropVegetationIndex}_GEE_Droid',
                scale: compositeCropIndex.projection().nominalScale().getInfo(),
                region: aoi.geometry().bounds(),
                maxPixels: 1e13
            });

            // 9. Exportation de la limite de l'AOI en GeoJSON
            Export.table.toDrive({
                collection: aoi.geometry().bounds(),
                description: 'AOI_Limite_GEE_Droid',
                fileFormat: 'GeoJSON'
            });
            print('GEE-Droid : Exportation des résultats vers Google Drive initiée.');
        } else {
             print('GEE-Droid Alerte : Aucun indice de culture n\'a pu être calculé pour le composite. Vérifiez les paramètres.');
        }
    }
`;
        }

        script += `
} // Fin du bloc 'if monthlyComposites is not empty'
} // Fin du bloc 'if collection is not empty'
        `;

        geeScriptOutput.value = script.trim();
        updateDroidStatus("Protocole d'analyse complet. Prêt pour le transfert.", 100);
    }

    // Copy script to clipboard
    copyScriptButton.addEventListener('click', () => {
        geeScriptOutput.select();
        document.execCommand('copy');
        updateDroidStatus("Script copié dans le presse-papiers. Bonne mission !", 100);
        setTimeout(() => updateDroidStatus("GEE-Droid : En attente de nouvelle commande.", 0), 3000); // Reset status
    });

    // Initial script generation on page load (if a default analysis is selected)
    analysisTypeSelect.dispatchEvent(new Event('change'));
    updateDroidStatus("GEE-Droid : Initialisation terminée. En attente de vos instructions.", 0);
});
