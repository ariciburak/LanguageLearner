import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { StorageService, NotificationSettings } from './StorageService';
import { Word } from '../models/Word';

// Bildirimleri konfigüre et
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Bildirim trigger tiplerini tanımlama
enum SchedulableTriggerInputTypes {
  DAILY = 'daily',
  TIME_INTERVAL = 'timeInterval',
}

export const NotificationService = {
  
  // Bildirimlere izin iste
  requestPermissions: async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  // Programlanmış bildirimleri iptal et
  cancelAllScheduledNotifications: async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
  
  // Rastgele bir kelimeyi seç
  getRandomWordForNotification: async (): Promise<Word | null> => {
    try {
      const words = await StorageService.getWords();
      const notificationWords = words.filter(word => word.inNotificationPool && !word.isLearned);
      
      if (notificationWords.length === 0) {
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * notificationWords.length);
      return notificationWords[randomIndex];
    } catch (error) {
      console.error('Rastgele kelime seçilirken hata oluştu:', error);
      return null;
    }
  },
  
  // Bildirimde gösterilecek içeriği oluştur
  createNotificationContent: (word: Word) => {
    return {
      title: `Kelime Hatırlatması: ${word.english}`,
      body: `Anlamı: ${word.turkish}`,
      data: { wordId: word.id }
    };
  },
  
  // Belirli bir saat için bildirim planla
  scheduleNotificationForHour: async (hour: number): Promise<string | null> => {
    try {
      const word = await NotificationService.getRandomWordForNotification();
      
      if (!word) {
        console.log('Bildirim için kelime bulunamadı');
        return null;
      }
      
      const content = NotificationService.createNotificationContent(word);
      
      // Basitleştirilmiş yaklaşım - saat ve dakika yerine saniye cinsinden programlama
      const now = new Date();
      const targetTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        0,
        0
      );
      
      // Eğer hedef saat geçmişse, yarına planla
      if (targetTime.getTime() <= now.getTime()) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      // Şimdiki zaman ile hedef zaman arasındaki farkı hesapla (saniye cinsinden)
      const secondsUntilTarget = Math.floor((targetTime.getTime() - now.getTime()) / 1000);
      
      // Any tipini kullanarak linter hatalarını önlüyoruz
      const trigger: any = { 
        seconds: secondsUntilTarget 
      };
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });
      
      return notificationId;
    } catch (error) {
      console.error('Bildirim planlanırken hata oluştu:', error);
      return null;
    }
  },
  
  // Belirtilen saatler arasında bildirimler planla
  scheduleNotificationsForToday: async (): Promise<void> => {
    try {
      // Önce tüm bildirimleri temizle
      await NotificationService.cancelAllScheduledNotifications();
      
      // Bildirim ayarlarını al
      const settings = await StorageService.getNotificationSettings();
      
      if (!settings.enabled) {
        console.log('Bildirimler devre dışı');
        return;
      }
      
      // Belirtilen saatler arasında bildirimler planla
      const { startHour, endHour } = settings;
      const now = new Date();
      const currentHour = now.getHours();
      
      for (let hour = startHour; hour <= endHour; hour++) {
        // Şu anki saatten sonraki saatler için bildirim planla
        if (hour > currentHour) {
          await NotificationService.scheduleNotificationForHour(hour);
        }
      }
      
      console.log('Bildirimler planlandı');
    } catch (error) {
      console.error('Bildirimler planlanırken hata oluştu:', error);
    }
  },
  
  // Rastgele bir bildirim planla (test için)
  scheduleRandomNotificationForTesting: async (): Promise<string | null> => {
    try {
      const word = await NotificationService.getRandomWordForNotification();
      
      if (!word) {
        console.log('Test bildirimi için kelime bulunamadı');
        return null;
      }
      
      const content = NotificationService.createNotificationContent(word);
      
      // 5 saniye sonra test bildirimi gönder
      // Any tipini kullanarak linter hatalarını önlüyoruz
      const trigger: any = { seconds: 5 };
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });
      
      return notificationId;
    } catch (error) {
      console.error('Test bildirimi planlanırken hata oluştu:', error);
      return null;
    }
  }
}; 