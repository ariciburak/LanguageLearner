import AsyncStorage from '@react-native-async-storage/async-storage';
import { Word } from '../models/Word';

const WORDS_STORAGE_KEY = 'word_learner_words';
const NOTIFICATION_SETTINGS_KEY = 'word_learner_notification_settings';

export interface NotificationSettings {
  startHour: number;
  endHour: number;
  enabled: boolean;
}

export const StorageService = {
  
  // Tüm kelimeleri getir
  getWords: async (): Promise<Word[]> => {
    try {
      const wordsJson = await AsyncStorage.getItem(WORDS_STORAGE_KEY);
      if (wordsJson) {
        return JSON.parse(wordsJson);
      }
      return [];
    } catch (error) {
      console.error('Kelimeler yüklenirken hata oluştu:', error);
      return [];
    }
  },

  // Kelime ekle
  addWord: async (word: Omit<Word, 'id' | 'createdAt' | 'isLearned' | 'inNotificationPool'>): Promise<Word> => {
    try {
      const words = await StorageService.getWords();
      
      const newWord: Word = {
        ...word,
        id: Date.now().toString(),
        createdAt: Date.now(),
        isLearned: false,
        inNotificationPool: true
      };
      
      const updatedWords = [...words, newWord];
      await AsyncStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(updatedWords));
      
      return newWord;
    } catch (error) {
      console.error('Kelime eklenirken hata oluştu:', error);
      throw error;
    }
  },

  // Kelimeyi güncelle
  updateWord: async (updatedWord: Word): Promise<void> => {
    try {
      const words = await StorageService.getWords();
      const updatedWords = words.map(word => 
        word.id === updatedWord.id ? updatedWord : word
      );
      
      await AsyncStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(updatedWords));
    } catch (error) {
      console.error('Kelime güncellenirken hata oluştu:', error);
      throw error;
    }
  },

  // Kelimeyi öğrenildi olarak işaretle
  markWordAsLearned: async (wordId: string): Promise<void> => {
    try {
      const words = await StorageService.getWords();
      const updatedWords = words.map(word => 
        word.id === wordId 
          ? { ...word, isLearned: true, inNotificationPool: false } 
          : word
      );
      
      await AsyncStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(updatedWords));
    } catch (error) {
      console.error('Kelime öğrenildi olarak işaretlenirken hata oluştu:', error);
      throw error;
    }
  },

  // Bildirim havuzundan kelimeyi çıkar/ekle
  toggleWordInNotificationPool: async (wordId: string, inPool: boolean): Promise<void> => {
    try {
      const words = await StorageService.getWords();
      const updatedWords = words.map(word => 
        word.id === wordId 
          ? { ...word, inNotificationPool: inPool } 
          : word
      );
      
      await AsyncStorage.setItem(WORDS_STORAGE_KEY, JSON.stringify(updatedWords));
    } catch (error) {
      console.error('Kelime bildirim havuzu durumu değiştirilirken hata oluştu:', error);
      throw error;
    }
  },

  // Bildirim ayarlarını kaydet
  saveNotificationSettings: async (settings: NotificationSettings): Promise<void> => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Bildirim ayarları kaydedilirken hata oluştu:', error);
      throw error;
    }
  },

  // Bildirim ayarlarını getir
  getNotificationSettings: async (): Promise<NotificationSettings> => {
    try {
      const settingsJson = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (settingsJson) {
        return JSON.parse(settingsJson);
      }
      return {
        startHour: 9, // Varsayılan başlangıç saati (sabah 9)
        endHour: 21,  // Varsayılan bitiş saati (akşam 9)
        enabled: true
      };
    } catch (error) {
      console.error('Bildirim ayarları yüklenirken hata oluştu:', error);
      return {
        startHour: 9,
        endHour: 21,
        enabled: true
      };
    }
  }
}; 