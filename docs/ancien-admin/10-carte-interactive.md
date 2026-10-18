# Carte interactive

**Chemin** : Carte interactive
**URL** : `/carte-interactive`

- Carte en temps réel (Leaflet + fond de carte OpenStreetMap, gratuit) affichant la position de **tous les chauffeurs**, pas seulement ceux en course.
- Liste des chauffeurs à droite avec statut **En ligne** / **Hors ligne** / **-** (pas de position) et bouton **Localiser** (centre la carte sur ce chauffeur).
- Boutons **Tout afficher** / **Tout masquer**, compteur "N/N affichés".
- Boutons **Masquer** (la liste) / **Plein écran** (la carte).

## Équivalent côté RenVTC (nouveau)
🟡 Partiel. Notre carte admin (Leaflet + OpenStreetMap, même techno) n'affiche que les chauffeurs **actuellement en course** (le seul moment où l'app chauffeur envoie sa position GPS, pour économiser la batterie). Pas de suivi permanent des chauffeurs disponibles mais inactifs, pas de statut En ligne/Hors ligne, pas de liste à côté de la carte.
