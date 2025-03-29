import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { NotificationService } from '@/app/services/NotificationService';
import { StorageService } from '@/app/services/StorageService';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// MaterialIcons için kullanılabilecek ikon tipleri
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

export default function HomeScreen() {
  const [english, setEnglish] = useState('');
  const [turkish, setTurkish] = useState('');
  const [startHour, setStartHour] = useState('9');
  const [endHour, setEndHour] = useState('21');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Bildirim ayarlarını yükle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await StorageService.getNotificationSettings();
        setStartHour(settings.startHour.toString());
        setEndHour(settings.endHour.toString());
        setNotificationsEnabled(settings.enabled);
      } catch (error) {
        console.error('Ayarlar yüklenirken hata oluştu:', error);
      }
    };
    
    loadSettings();
  }, []);

  // Bildirimlere izin iste
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Bildirim İzni',
          'Kelime hatırlatmaları için bildirim izni gereklidir.',
          [{ text: 'Tamam' }]
        );
      }
    };
    
    requestNotificationPermissions();
  }, []);

  // Kelime ekle
  const addWord = async () => {
    if (!english.trim() || !turkish.trim()) {
      Alert.alert('Hata', 'Lütfen hem İngilizce hem de Türkçe kelimeyi girin.');
      return;
    }

    try {
      await StorageService.addWord({
        english: english.trim(),
        turkish: turkish.trim()
      });
      
      setEnglish('');
      setTurkish('');
      
      Alert.alert('Başarılı', 'Kelime başarıyla eklendi!');
    } catch (error) {
      Alert.alert('Hata', 'Kelime eklenirken bir hata oluştu.');
      console.error(error);
    }
  };

  // Bildirim ayarlarını kaydet
  const saveSettings = async () => {
    try {
      const startHourNum = parseInt(startHour, 10);
      const endHourNum = parseInt(endHour, 10);
      
      if (isNaN(startHourNum) || isNaN(endHourNum) || startHourNum < 0 || startHourNum > 23 || endHourNum < 0 || endHourNum > 23) {
        Alert.alert('Hata', 'Lütfen saat değerlerini 0-23 arasında girin.');
        return;
      }
      
      if (startHourNum >= endHourNum) {
        Alert.alert('Hata', 'Başlangıç saati, bitiş saatinden küçük olmalıdır.');
        return;
      }
      
      await StorageService.saveNotificationSettings({
        startHour: startHourNum,
        endHour: endHourNum,
        enabled: notificationsEnabled
      });
      
      // Bildirimleri yeniden planla
      if (notificationsEnabled) {
        await NotificationService.scheduleNotificationsForToday();
        Alert.alert('Başarılı', 'Bildirim ayarları kaydedildi ve bildirimler güncellendi.');
      } else {
        await NotificationService.cancelAllScheduledNotifications();
        Alert.alert('Başarılı', 'Bildirimler devre dışı bırakıldı.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu.');
      console.error(error);
    }
  };

  // Test bildirimi gönder
  const sendTestNotification = async () => {
    try {
      const notificationId = await NotificationService.scheduleRandomNotificationForTesting();
      if (notificationId) {
        Alert.alert('Bildirim Gönderildi', '5 saniye içinde test bildirimi alacaksınız.');
      } else {
        Alert.alert('Hata', 'Bildirim havuzunda kelime bulunmuyor. Lütfen önce kelime ekleyin.');
      }
    } catch (error) {
      Alert.alert('Hata', 'Test bildirimi gönderilirken bir hata oluştu.');
      console.error(error);
    }
  };

  const renderCardContent = (content: React.ReactNode) => {
    return Platform.OS === 'ios' ? (
      <BlurView intensity={30} tint="light" style={styles.blurCard}>
        {content}
      </BlurView>
    ) : (
      <View style={styles.androidCard}>
        {content}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCardContent(
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="add-circle" size={28} color="#0284c7" />
                <ThemedText style={styles.cardTitle}>Kelime Ekle</ThemedText>
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="İngilizce kelime"
                  value={english}
                  onChangeText={setEnglish}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Türkçe anlamı"
                  value={turkish}
                  onChangeText={setTurkish}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              
              <TouchableOpacity style={styles.button} onPress={addWord}>
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7', '#0369a1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <ThemedText style={styles.buttonText}>Kelime Ekle</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
          
          {renderCardContent(
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="notifications" size={28} color="#0284c7" />
                <ThemedText style={styles.cardTitle}>Bildirim Ayarları</ThemedText>
              </View>
              
              <View style={styles.settingsRow}>
                <ThemedText style={styles.settingLabel}>Bildirimler</ThemedText>
                <TouchableOpacity onPress={() => setNotificationsEnabled(!notificationsEnabled)}>
                  <MaterialIcons 
                    name={notificationsEnabled ? "toggle-on" : "toggle-off"} 
                    size={38} 
                    color={notificationsEnabled ? "#0284c7" : "#cbd5e1"} 
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.timeInputContainer}>
                <View style={styles.timeInput}>
                  <ThemedText style={styles.settingLabel}>Başlangıç Saati</ThemedText>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.hourInput}
                      keyboardType="numeric"
                      value={startHour}
                      onChangeText={setStartHour}
                      maxLength={2}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
                
                <View style={styles.timeInput}>
                  <ThemedText style={styles.settingLabel}>Bitiş Saati</ThemedText>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.hourInput}
                      keyboardType="numeric"
                      value={endHour}
                      onChangeText={setEndHour}
                      maxLength={2}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </View>
              
              <TouchableOpacity style={styles.button} onPress={saveSettings}>
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7', '#0369a1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <ThemedText style={styles.buttonText}>Ayarları Kaydet</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.button, styles.marginTop]} onPress={sendTestNotification}>
                <LinearGradient
                  colors={['#f97316', '#ea580c', '#c2410c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <ThemedText style={styles.buttonText}>Test Bildirimi Gönder</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  blurCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  androidCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#0c4a6e',
  },
  inputContainer: {
    backgroundColor: 'rgba(248,250,252,0.7)',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  input: {
    height: 54,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#334155',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  marginTop: {
    marginTop: 12,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#334155',
  },
  timeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeInput: {
    width: '48%',
  },
  hourInput: {
    height: 54,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    marginVertical: 10,
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(241,245,249,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#334155',
    flex: 1,
    lineHeight: 22,
  },
});
