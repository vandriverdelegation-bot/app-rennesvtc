import { useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, whatsappUrl, themedStyles } from '@app-rennesvtc/shared';
import { COMPANY_PHONE, euro, shortDay, timeOf } from '../lib/format';
import { Icon } from '../icons';
import { FONT } from '../ui';
import RideCard from './RideCard';
import EndScreen, { rideToRate } from './RateCard';
import TrackScreen from './TrackScreen';

const c = theme.colors;

const SHORTCUTS = [
  { key: 'airport', label: 'Aéroport', icon: 'plane' },
  { key: 'station', label: 'Gare', icon: 'train' },
  { key: 'home', label: 'Domicile', icon: 'home' },
];

// Halo discret derriere l'en-tete : cercles concentriques tres transparents, a defaut de degrade radial.
function Halo() {
  return (
    <View pointerEvents="none" style={styles.halo}>
      {Array.from({ length: 16 }, (_, i) => 340 - i * 20).map((size) => (
        <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: theme.mode === 'light' ? 'rgba(21,128,61,0.012)' : 'rgba(34,197,94,0.012)' }} />
      ))}
    </View>
  );
}

function BrandName({ appName }) {
  const words = appName.trim().split(' ');
  const last = words.pop();
  return (
    <Text style={styles.brand}>
      {words.length ? words.join(' ').toUpperCase() + ' ' : ''}
      <Text style={{ color: theme.colors.accent }}>{last.toUpperCase()}</Text>
    </Text>
  );
}

function PastRide({ ride, onRebook }) {
  const when = new Date(ride.scheduled_at ?? ride.created_at);
  const canRebook = ride.pickup_lat && ride.dropoff_lat;
  return (
    <View style={styles.pastCard}>
      <View style={styles.pastTop}>
        <Text style={styles.pastDate}>
          {shortDay(when)} · {timeOf(when)}
          {ride.status === 'cancelled' ? ' · Annulée' : ''}
          {ride.rating ? ' · ' + '★'.repeat(ride.rating) : ''}
        </Text>
        <Text style={styles.pastPrice}>{ride.price != null ? euro(ride.price) : ''}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <View style={styles.pastLine}>
          <View style={styles.dotStart} />
          <Text style={styles.pastAddress} numberOfLines={2}>{ride.pickup_address}</Text>
        </View>
        <View style={styles.pastLine}>
          <View style={styles.dotEnd} />
          <Text style={styles.pastAddress} numberOfLines={2}>{ride.dropoff_address}</Text>
        </View>
      </View>
      {canRebook ? (
        <TouchableOpacity style={styles.rebook} onPress={onRebook} activeOpacity={0.8}>
          <Icon name="repeat" color="g" size={16} />
          <Text style={styles.rebookText}>Recommander ce trajet</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function MenuCard({ icon, title, sub, onPress, main, dim }) {
  return (
    <TouchableOpacity style={[styles.card, main && styles.cardMain, false]} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.cardIcon, main && styles.cardIconMain]}>
        <Icon name={icon} color={main ? 'white' : 'g'} size={26} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.cardSub, main && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>{sub}</Text>
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </TouchableOpacity>
  );
}

// Accueil client : photo, logo, bonjour, puis Reserver / Mes courses / Suivi de ma course / Aide. La page « Mes courses » (a venir / passees) est une page a part.
export default function HomeView({ session, appName, firstName, fullName, isAdmin, initials, rides, history, page = 'home', onOpenCourses, onBook, onShortcut, onChanged, onOpenAccount, onOpenNotifications, focus }) {
  const [tab, setTab] = useState('upcoming');
  const [rateDismissed, setRateDismissed] = useState([]); // courses dont le client a ferme l'ecran de fin
  const [tracking, setTracking] = useState(false);
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0); // hauteur de la barre d'etat, meme quand Android ne la declare pas
  const { height: winH } = useWindowDimensions();
  const heroH = Math.min(440, Math.max(352, Math.round(winH * 0.42))); // la photo occupe environ 40 % de l'ecran, sous la barre d'etat
  const toRate = rideToRate(history);
  const trackRide = rides.find((r) => r.status === 'accepted' && ['en_route', 'on_site', 'on_board'].includes(r.ride_step)) ?? rides.find((r) => r.status === 'accepted');

  function openTracking() {
    if (trackRide) setTracking(true);
    else Alert.alert('Aucune course en cours', "Le suivi en direct apparaît dès qu'un chauffeur a confirmé votre course.");
  }

  function askHelp() {
    Alert.alert("Besoin d'aide ?", 'Rennes VTC est joignable 7j/7.', [
      { text: 'Appeler', onPress: () => Linking.openURL(`tel:${COMPANY_PHONE}`) },
      { text: 'WhatsApp', onPress: () => Linking.openURL(whatsappUrl(COMPANY_PHONE)) },
      { text: 'Fermer', style: 'cancel' },
    ]);
  }

  if (tracking && trackRide) {
    return <TrackScreen ride={trackRide} session={session} onBack={() => setTracking(false)} onChanged={onChanged} />;
  }

  const endScreen = toRate && !rateDismissed.includes(toRate.id) ? (
    <EndScreen
      key={toRate.id}
      ride={toRate}
      session={session}
      onClose={() => setRateDismissed((d) => [...d, toRate.id])}
      onHistory={() => { setTab('past'); onOpenCourses?.(); }}
    />
  ) : null;

  if (page === 'courses') {
    return (
      <View style={styles.root}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingTop: 20 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Mes courses</Text>
          <View style={styles.bookings}>
            <View style={styles.tabs}>
              {[
                { key: 'upcoming', label: `À venir · ${rides.length}` },
                { key: 'past', label: `Passées · ${history.length}` },
              ].map((t) => (
                <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabOn]} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
                  <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'upcoming' ? (
              rides.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Aucune réservation à venir</Text>
                  <Text style={styles.emptyText}>Commandez votre prochaine course en quelques secondes.</Text>
                </View>
              ) : (
                rides.map((r) => <RideCard key={r.id} ride={r} session={session} onChanged={onChanged} />)
              )
            ) : history.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Aucune course passée</Text>
                <Text style={styles.emptyText}>Vos courses terminées apparaîtront ici.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {history.map((h) => (
                  <PastRide
                    key={h.id}
                    ride={h}
                    onRebook={() =>
                      onBook({
                        pickup: { address: h.pickup_address, lat: h.pickup_lat, lng: h.pickup_lng },
                        dropoff: { address: h.dropoff_address, lat: h.dropoff_lat, lng: h.dropoff_lng },
                      })
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        {endScreen}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBox, { height: heroH }]}>
          <Image source={require('../assets/hero-rennes.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,12,11,0.18)' }]} />
          <View pointerEvents="none" style={styles.fadeBottom}>
            {Array.from({ length: 12 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: `rgba(${theme.mode === 'light' ? '245,245,240' : '11,12,11'},${((i + 1) / 12) ** 1.6})` }} />)}
          </View>
          <View style={[styles.heroTop, { top: topPad + 12 }]}>
            <TouchableOpacity onPress={onOpenAccount} style={styles.burger} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Menu">
              <View style={styles.burgerLine} /><View style={styles.burgerLine} /><View style={styles.burgerLine} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.accountChip} onPress={onOpenAccount} accessibilityLabel="Mon compte">
              <Icon name="user" color="g" size={18} />
              <Text style={styles.accountChipText}>Mon compte</Text>
            </TouchableOpacity>
          </View>
          <Image source={require('../assets/logo-rennesvtc.png')} style={[styles.logo, { top: topPad + 66 }]} resizeMode="contain" accessibilityLabel="Rennes VTC" />
          <View style={styles.greeting}>
            <Text style={styles.hello}>Bonjour,</Text>
            <Text style={styles.name} numberOfLines={1}>{fullName || firstName || 'et bienvenue'}</Text>
            <View style={styles.underline} />
          </View>
        </View>

        <View style={styles.cards}>
          <MenuCard main icon="van" title="Réserver une course" sub="En quelques clics" onPress={() => onBook()} />
          <MenuCard icon="history" title="Mes courses" sub="Consulter mon historique" onPress={onOpenCourses} />
          <MenuCard icon="pin" title="Suivi de ma course" sub="Suivre ma course en temps réel" onPress={openTracking} />
          <MenuCard icon="headset" title="Besoin d'aide ?" sub="Contactez-nous" onPress={askHelp} />
          {isAdmin ? <MenuCard icon="user" title="Back-office" sub="Administration Rennes VTC" onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_BACKEND_URL}/admin/`)} /> : null}
        </View>
      </ScrollView>
      {endScreen}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, width: '100%', backgroundColor: c.background },
  pageTitle: { color: c.text, fontSize: 28, fontFamily: FONT.title, marginBottom: 6 },
  heroBox: { height: 340, overflow: 'hidden', backgroundColor: '#0B0C0B' },
  fadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  heroTop: { position: 'absolute', top: 16, left: 22, right: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  burger: { gap: 5, padding: 4 },
  burgerLine: { width: 26, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(10,12,10,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  accountChipText: { color: '#F2F2EE', fontSize: 14, fontFamily: FONT.semi },
  logo: { position: 'absolute', top: 54, alignSelf: 'center', width: 168, height: 126 },
  greeting: { position: 'absolute', left: 24, right: 24, bottom: 22 },
  hello: { color: '#E8EAE6', fontSize: 20, fontFamily: FONT.body },
  name: { color: '#FFFFFF', fontSize: 32, fontFamily: FONT.title, marginTop: 2 },
  underline: { width: 44, height: 4, borderRadius: 2, backgroundColor: c.accent, marginTop: 8 },
  cards: { paddingHorizontal: 22, paddingTop: 6, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 14, paddingHorizontal: 16 },
  cardMain: { backgroundColor: '#0F5F2C', borderColor: c.accent, borderWidth: 2 },
  cardChevron: { color: '#FFFFFF', fontSize: 30, lineHeight: 32, marginRight: 2 },
  cardIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  cardIconMain: { backgroundColor: 'rgba(0,0,0,0.28)' },
  cardTitle: { color: c.text, fontSize: 19, fontFamily: FONT.title },
  cardSub: { color: c.textMuted, fontSize: 14, fontFamily: FONT.body, marginTop: 2 },

  halo: { position: 'absolute', top: -140, right: -120, width: 340, height: 340, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 120, gap: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#000000', borderWidth: 1, borderColor: c.cardBorder, alignItems: 'center', justifyContent: 'center' },
  brand: { color: c.text, fontSize: 17, fontFamily: FONT.bold, letterSpacing: 0.7 },
  tagline: { color: c.textMuted, fontSize: 10, fontFamily: FONT.body, letterSpacing: 2.2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  initials: { color: c.text, fontSize: 15, fontFamily: FONT.title },
  hero: { gap: 18 },
  hello: { color: c.textMuted, fontSize: 14, fontFamily: FONT.body, marginBottom: 4 },
  h1: { color: c.text, fontSize: 32, lineHeight: 35, fontFamily: FONT.title, letterSpacing: -0.3 },
  cta: { minHeight: 64, borderRadius: 20, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 20, paddingRight: 10 },
  ctaTitle: { color: c.accentText, fontSize: 18, fontFamily: FONT.title },
  ctaSub: { color: c.accentText, opacity: 0.75, fontSize: 12, fontFamily: FONT.body },
  ctaArrow: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.accentText, alignItems: 'center', justifyContent: 'center' },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, minHeight: 76, borderRadius: 18, borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card, paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'space-between', alignItems: 'flex-start' },
  shortcutText: { color: c.text, fontSize: 13, fontFamily: FONT.medium },
  bookings: { gap: 16 },
  h2: { color: c.text, fontSize: 22, fontFamily: FONT.title },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: c.text },
  tabText: { color: c.textMuted, fontSize: 14, fontFamily: FONT.semi },
  tabTextOn: { color: c.background },
  empty: { borderRadius: 22, borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card, padding: 20, gap: 4 },
  emptyTitle: { color: c.text, fontSize: 17, fontFamily: FONT.title },
  emptyText: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  pastCard: { borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  pastTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pastDate: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body, flex: 1 },
  pastPrice: { color: c.text, fontSize: 17, fontFamily: FONT.title },
  pastLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotStart: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  dotEnd: { width: 8, height: 8, borderRadius: 2, backgroundColor: c.text },
  pastAddress: { color: c.text, fontSize: 14, fontFamily: FONT.body, flex: 1 },
  rebook: { minHeight: 44, borderRadius: 12, backgroundColor: c.accentSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  rebookText: { color: c.accentLight, fontSize: 13, fontFamily: FONT.semi },
  assurance: { borderRadius: 22, borderWidth: 1, borderColor: c.cardBorder, paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  assuranceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.accentTint, alignItems: 'center', justifyContent: 'center' },
  assuranceTitle: { color: c.text, fontSize: 15, fontFamily: FONT.semi },
  assuranceSub: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body, marginTop: 2 },
  assuranceLink: { color: c.accentLight, fontSize: 14, fontFamily: FONT.semi },
}));
