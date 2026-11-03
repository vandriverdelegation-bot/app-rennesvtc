import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, whatsappUrl } from '@app-rennesvtc/shared';
import { COMPANY_PHONE, euro, shortDay, timeOf } from '../lib/format';
import { Icon } from '../icons';
import { FONT } from '../ui';
import RideCard from './RideCard';

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
        <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(91,212,42,0.012)' }} />
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
      <Text style={{ color: '#5BD42A' }}>{last.toUpperCase()}</Text>
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

// Accueil client : en-tete, commande rapide, reservations (a venir / passees) et reassurance.
export default function HomeView({ session, appName, firstName, initials, rides, history, onBook, onShortcut, onChanged, onOpenAccount, onOpenNotifications, focus }) {
  const [tab, setTab] = useState('upcoming');
  const scrollRef = useRef(null);
  const bookingsY = useRef(0);
  const pending = useRef(null); // defilement demande avant que la mise en page soit connue

  // Les boutons Accueil / Reservations de la barre du bas font defiler jusqu'a la bonne zone.
  useEffect(() => {
    if (!focus) return;
    if (focus.to === 'bookings' && !bookingsY.current) pending.current = focus;
    else scrollRef.current?.scrollTo({ y: focus.to === 'bookings' ? Math.max(bookingsY.current - 12, 0) : 0, animated: true });
  }, [focus]);

  return (
    <View style={styles.root}>
      <Halo />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoTile}>
              <Icon name="star" color="g" size={22} />
            </View>
            <View style={{ gap: 2 }}>
              <BrandName appName={appName} />
              <Text style={styles.tagline}>CHAUFFEUR PRIVÉ</Text>
            </View>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenNotifications} accessibilityLabel="Notifications">
              <Icon name="bell" color="w" size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#1C201C' }]} onPress={onOpenAccount} accessibilityLabel="Mon compte">
              <Text style={styles.initials}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          <View>
            <Text style={styles.hello}>{firstName ? `Bonjour ${firstName},` : 'Bonjour,'}</Text>
            <Text style={styles.h1}>{'Où allez-vous\naujourd\'hui ?'}</Text>
          </View>
          <TouchableOpacity style={styles.cta} onPress={() => onBook()} activeOpacity={0.85}>
            <Icon name="search" color="k" size={22} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Commander une course</Text>
              <Text style={styles.ctaSub}>Immédiate ou à l'avance</Text>
            </View>
            <View style={styles.ctaArrow}>
              <Icon name="arrow" color="g" size={20} />
            </View>
          </TouchableOpacity>
          <View style={styles.shortcuts}>
            {SHORTCUTS.map((s) => (
              <TouchableOpacity key={s.key} style={styles.shortcut} onPress={() => onShortcut(s.key)} activeOpacity={0.8}>
                <Icon name={s.icon} color="g" size={20} />
                <Text style={styles.shortcutText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.bookings} onLayout={(e) => {
          bookingsY.current = e.nativeEvent.layout.y;
          if (pending.current) scrollRef.current?.scrollTo({ y: Math.max(bookingsY.current - 12, 0), animated: false });
          pending.current = null;
        }}>
          <Text style={styles.h2}>Mes réservations</Text>
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

        <View style={styles.assurance}>
          <View style={styles.assuranceIcon}>
            <Icon name="message" color="g" size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.assuranceTitle}>Une question ?</Text>
            <Text style={styles.assuranceSub}>Votre chauffeur répond 7j/7</Text>
          </View>
          <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => Linking.openURL(whatsappUrl(COMPANY_PHONE))}>
            <Text style={styles.assuranceLink}>Écrire</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', backgroundColor: c.background },
  halo: { position: 'absolute', top: -140, right: -120, width: 340, height: 340, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 20, paddingHorizontal: 24, paddingBottom: 120, gap: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#000000', borderWidth: 1, borderColor: '#2A2E2A', alignItems: 'center', justifyContent: 'center' },
  brand: { color: c.text, fontSize: 17, fontFamily: FONT.bold, letterSpacing: 0.7 },
  tagline: { color: c.textMuted, fontSize: 10, fontFamily: FONT.body, letterSpacing: 2.2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#2A2E2A', backgroundColor: '#141614', alignItems: 'center', justifyContent: 'center' },
  initials: { color: c.text, fontSize: 15, fontFamily: FONT.title },
  hero: { gap: 18 },
  hello: { color: c.textMuted, fontSize: 14, fontFamily: FONT.body, marginBottom: 4 },
  h1: { color: c.text, fontSize: 32, lineHeight: 35, fontFamily: FONT.title, letterSpacing: -0.3 },
  cta: { minHeight: 64, borderRadius: 20, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 20, paddingRight: 10 },
  ctaTitle: { color: '#0B0C0B', fontSize: 18, fontFamily: FONT.title },
  ctaSub: { color: 'rgba(11,12,11,0.75)', fontSize: 12, fontFamily: FONT.body },
  ctaArrow: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#0B0C0B', alignItems: 'center', justifyContent: 'center' },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, minHeight: 76, borderRadius: 18, borderWidth: 1, borderColor: '#262A26', backgroundColor: '#141614', paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'space-between', alignItems: 'flex-start' },
  shortcutText: { color: c.text, fontSize: 13, fontFamily: FONT.medium },
  bookings: { gap: 16 },
  h2: { color: c.text, fontSize: 22, fontFamily: FONT.title },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#141614', borderWidth: 1, borderColor: '#222622' },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: '#F2F2EE' },
  tabText: { color: c.textMuted, fontSize: 14, fontFamily: FONT.semi },
  tabTextOn: { color: '#0B0C0B' },
  empty: { borderRadius: 22, borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card, padding: 20, gap: 4 },
  emptyTitle: { color: c.text, fontSize: 17, fontFamily: FONT.title },
  emptyText: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body },
  pastCard: { borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: '#262A26', paddingVertical: 16, paddingHorizontal: 18, gap: 12 },
  pastTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pastDate: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body, flex: 1 },
  pastPrice: { color: c.text, fontSize: 17, fontFamily: FONT.title },
  pastLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotStart: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  dotEnd: { width: 8, height: 8, borderRadius: 2, backgroundColor: c.text },
  pastAddress: { color: c.text, fontSize: 14, fontFamily: FONT.body, flex: 1 },
  rebook: { minHeight: 44, borderRadius: 12, backgroundColor: '#1F241F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  rebookText: { color: '#7EE04F', fontSize: 13, fontFamily: FONT.semi },
  assurance: { borderRadius: 22, borderWidth: 1, borderColor: '#262A26', paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  assuranceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(91,212,42,0.12)', alignItems: 'center', justifyContent: 'center' },
  assuranceTitle: { color: c.text, fontSize: 15, fontFamily: FONT.semi },
  assuranceSub: { color: c.textMuted, fontSize: 13, fontFamily: FONT.body, marginTop: 2 },
  assuranceLink: { color: '#7EE04F', fontSize: 14, fontFamily: FONT.semi },
});
