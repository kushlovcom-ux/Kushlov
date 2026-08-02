import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { getErrorMessage } from '@/api/client';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'LocationSetup'>;

export function LocationSetupScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const detect = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to discover people nearby.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const p = places[0];
      if (p?.city) setCity(p.city);
    } catch (err) {
      Alert.alert('Location error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!coords) {
      Alert.alert('Detect first', 'Tap detect location before saving.');
      return;
    }
    setLoading(true);
    try {
      await usersApi.updateLocation({
        lat: coords.lat,
        lng: coords.lng,
        city: city || undefined,
      });
      await qc.invalidateQueries({ queryKey: queryKeys.location });
      await qc.invalidateQueries({ queryKey: ['discover'] });
      Alert.alert('Saved', 'Your location is updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Location" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.lg }}>
        Browse Discover hides people within about 10 km of you. Searching by name finds anyone,
        nearby or far.
      </Text>
      <Button title="Detect my location" onPress={detect} loading={loading} fullWidth />
      {coords ? (
        <Text muted style={{ marginTop: spacing.md }}>
          {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        </Text>
      ) : null}
      <View style={{ height: spacing.lg }} />
      <Input label="City (optional)" value={city} onChangeText={setCity} />
      <View style={{ height: spacing.xl }} />
      <Button title="Save location" onPress={save} loading={loading} fullWidth />
    </Screen>
  );
}
