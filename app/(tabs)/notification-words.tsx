import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, Animated } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { StorageService } from '@/app/services/StorageService';
import { NotificationService } from '@/app/services/NotificationService';
import { Word } from '@/app/models/Word';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationWordsScreen() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Toast benzeri bildirim için state'ler
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Swipeable referansları için bir map objesi oluştur
  const swipeableRefs = useRef<{[key: string]: Swipeable | null}>({});

  // Kelimeleri yükle
  const loadWords = async () => {
    try {
      setLoading(true);
      const allWords = await StorageService.getWords();
      // Sadece bildirim havuzundaki kelimeleri filtrele
      const notificationWords = allWords.filter(word => word.inNotificationPool && !word.isLearned);
      setWords(notificationWords);
    } catch (error) {
      console.error('Kelimeler yüklenirken hata oluştu:', error);
      Alert.alert('Hata', 'Kelimeler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWords();
  }, []);

  // Kelimeyi öğrenildi olarak işaretle
  const markAsLearned = async (wordId: string) => {
    try {
      // Önce haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Kelimeyi bul
      const word = words.find(w => w.id === wordId);
      if (!word) return;
      
      // Önce yerel state'i güncelle (daha hızlı geri bildirim için)
      const updatedWords = words.filter(w => w.id !== wordId);
      setWords(updatedWords);
      
      // Veritabanını güncelle
      await StorageService.markWordAsLearned(wordId);
      // Bildirimleri güncelle
      await NotificationService.scheduleNotificationsForToday();
      
      // Toast mesajı göster
      showToast(`"${word.english}" öğrenildi olarak işaretlendi`);
    } catch (error) {
      console.error('Kelime öğrenildi olarak işaretlenirken hata oluştu:', error);
      Alert.alert('Hata', 'Kelime durumu değiştirilirken bir sorun oluştu.');
      loadWords(); // Hata durumunda kelimeleri tekrar yükle
    }
  };

  // Kelimeyi bildirim havuzundan çıkar
  const removeFromNotificationPool = async (wordId: string) => {
    try {
      // Önce haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Kelimeyi bul
      const word = words.find(w => w.id === wordId);
      if (!word) return;
      
      // Önce yerel state'i güncelle (daha hızlı geri bildirim için)
      const updatedWords = words.filter(w => w.id !== wordId);
      setWords(updatedWords);
      
      // Veritabanını güncelle
      await StorageService.toggleWordInNotificationPool(wordId, false);
      // Bildirimleri güncelle
      await NotificationService.scheduleNotificationsForToday();
      
      // Toast mesajı göster
      showToast(`"${word.english}" bildirim havuzundan çıkarıldı`);
    } catch (error) {
      console.error('Kelime bildirim havuzundan çıkarılırken hata oluştu:', error);
      Alert.alert('Hata', 'Kelime bildirim havuzundan çıkarılırken bir sorun oluştu.');
      loadWords(); // Hata durumunda kelimeleri tekrar yükle
    }
  };

  // Kelimeyi sil
  const deleteWord = async (wordId: string) => {
    try {
      // Silme işleminden önce onay iste
      Alert.alert(
        'Kelimeyi Sil',
        'Bu kelimeyi silmek istediğinizden emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          { 
            text: 'Sil', 
            style: 'destructive',
            onPress: async () => {
              // Kelimeyi bul
              const word = words.find(w => w.id === wordId);
              if (!word) return;
              
              // Önce yerel state'i güncelle
              const updatedWords = words.filter(w => w.id !== wordId);
              setWords(updatedWords);
              
              // Haptic feedback
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              }
              
              // StorageService'e kelime silme işlevi ekleyeceğiz, şimdilik tüm kelimeleri alıp, silinecek hariç geri kaydediyoruz
              const allWords = await StorageService.getWords();
              const filteredWords = allWords.filter(w => w.id !== wordId);
              await AsyncStorage.setItem('word_learner_words', JSON.stringify(filteredWords));
              
              // Toast mesajı göster
              showToast(`"${word.english}" silindi`);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Kelime silinirken hata oluştu:', error);
      Alert.alert('Hata', 'Kelime silinirken bir sorun oluştu.');
      loadWords(); // Hata durumunda kelimeleri tekrar yükle
    }
  };

  // Bildirimleri yeniden planla
  const rescheduleNotifications = async () => {
    try {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      await NotificationService.scheduleNotificationsForToday();
      
      // Toast mesajı göster
      showToast('Bildirimler yeniden planlandı');
    } catch (error) {
      Alert.alert('Hata', 'Bildirimler planlanırken bir sorun oluştu.');
    }
  };

  // Toast mesajı göster
  const showToast = (message: string) => {
    // Önceki toast'u temizle
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    // Yeni toast göster
    setToastMessage(message);
    setToastVisible(true);
    
    // Toast'u otomatik kapat
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  };

  // Filtrelenmiş kelimeler
  const filteredWords = words.filter(word => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      word.english.toLowerCase().includes(searchLower) ||
      word.turkish.toLowerCase().includes(searchLower)
    );
  });

  // Kelime öğesi bileşeni
  const renderWordItem = (item: Word) => {
    // Silme butonu (sağ tarafta görünecek)
    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const trans = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [0, 100],
        extrapolate: 'clamp',
      });
      
      return (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            // Silmeye başlamadan önce swipeable'ı kapat
            if (swipeableRefs.current[item.id]) {
              swipeableRefs.current[item.id]?.close();
            }
            
            // Silme işlemini başlat
            deleteWord(item.id);
          }}
        >
          <LinearGradient
            colors={['#f87171', '#ef4444', '#dc2626']}
            style={styles.deleteActionGradient}
          >
            <MaterialIcons name="delete" size={24} color="#FFF" />
            <ThemedText style={styles.deleteActionText}>Sil</ThemedText>
          </LinearGradient>
        </TouchableOpacity>
      );
    };

    // Kelime kartı için arka plan renklerini belirle - bildirim rengi olarak mavi
    const cardColors = ['#ffffff', '#f0f9ff', '#dbeafe'] as const; // Beyaz ağırlıklı, çok hafif mavi ton
    
    // Türkçe anlamları satırlara ayır
    const turkishMeanings = item.turkish ? item.turkish.split('\n') : [];
    
    const CardContent = (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          // Önce haptic feedback
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          
          // Öğrenildi olarak işaretle
          markAsLearned(item.id);
        }}
        onLongPress={() => {
          // Haptic geri bildirim ekle
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          
          // Bildirim havuzundan çıkar
          removeFromNotificationPool(item.id);
        }}
        // Uzun basış hissini daha belirgin hale getirme
        delayLongPress={300}
      >
        <LinearGradient
          colors={cardColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wordItemGradient}
        >
          <View style={styles.wordItemContent}>
            <View style={styles.wordHeader}>
              <ThemedText style={styles.englishWord}>{item.english}</ThemedText>
              <View style={styles.statusBadge}>
                <MaterialIcons name="notifications-active" size={14} color="#FFF" />
                <ThemedText style={styles.statusText}>Bildirim</ThemedText>
              </View>
            </View>
            
            {turkishMeanings.length > 0 ? (
              <View style={styles.turkishMeaningsContainer}>
                {turkishMeanings.map((meaning, index) => (
                  <ThemedText 
                    key={index} 
                    style={[
                      styles.turkishWord,
                      index > 0 ? { marginTop: 4 } : null
                    ]}
                  >
                    {`${index + 1}. ${meaning}`}
                  </ThemedText>
                ))}
              </View>
            ) : (
              <ThemedText style={styles.turkishWord}>
                Anlam verisi yok!
              </ThemedText>
            )}
            
            <View style={styles.hintContainer}>
              <ThemedText style={styles.hintText}>
                <MaterialIcons name="touch-app" size={14} color="#64748b" /> Tek tıklama: Öğrenildi olarak işaretle
              </ThemedText>
              <ThemedText style={styles.hintText}>
                <MaterialIcons name="pan-tool" size={14} color="#64748b" /> Uzun basma: Bildirimlerden çıkar
              </ThemedText>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );

    return (
      <View style={styles.wordItem}>
        <Swipeable
          ref={ref => swipeableRefs.current[item.id] = ref}
          renderRightActions={renderRightActions}
          friction={2}
          rightThreshold={40}
        >
          <View style={styles.cardContainer}>
            {CardContent}
          </View>
        </Swipeable>
      </View>
    );
  };

  const renderInfoCard = () => {
    return (
      <View style={styles.infoContainer}>
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={['#f8fafc', '#f1f5f9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoGradient}
          >
            <View style={styles.infoCardContent}>
              <ThemedText style={styles.infoText}>
                Bu sayfada bildirim olarak görüntülenecek kelimeleri görebilirsiniz.
              </ThemedText>
              <TouchableOpacity 
                style={styles.scheduleButton} 
                onPress={rescheduleNotifications}
              >
                <LinearGradient
                  colors={['#60a5fa', '#3b82f6', '#2563eb']}
                  style={styles.scheduleButtonGradient}
                >
                  <MaterialIcons name="refresh" size={20} color="#FFF" style={styles.scheduleIcon} />
                  <ThemedText style={styles.scheduleButtonText}>Bildirimleri Yeniden Planla</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    );
  };

  // Toast/Snackbar bileşeni
  const renderToast = () => {
    if (!toastVisible) return null;
    
    return (
      <View style={styles.toastContainer}>
        <LinearGradient
          colors={['#0ea5e9', '#0284c7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.toast}
        >
          <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
          <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#0284c7" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Kelime ara..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#94a3b8"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <MaterialIcons name="clear" size={24} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>
      
      {loading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <ThemedText style={styles.loadingText}>Kelimeler yükleniyor...</ThemedText>
        </View>
      ) : filteredWords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="notifications-none" size={48} color="#9ca3af" />
          {searchText ? (
            <ThemedText style={styles.emptyText}>Arama sonucu bulunamadı.</ThemedText>
          ) : (
            <ThemedText style={styles.emptyText}>Bildirim havuzunda kelime yok.</ThemedText>
          )}
          {!searchText && (
            <ThemedText style={styles.emptySubText}>
              Ana sayfadan İngilizce kelimeler ekleyebilirsiniz.
            </ThemedText>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredWords}
          renderItem={({ item }) => renderWordItem(item)}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            loadWords();
          }}
          ListFooterComponent={renderInfoCard}
        />
      )}
      
      {renderToast()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 54,
    fontSize: 16,
    color: '#334155',
  },
  wordItem: {
    marginBottom: 10,
  },
  cardContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  wordItemGradient: {
    borderRadius: 12,
  },
  wordItemContent: {
    padding: 14,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  englishWord: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  turkishWord: {
    fontSize: 16,
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  turkishMeaningsContainer: {
    marginTop: 4,
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  hintContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(203,213,225,0.5)',
    paddingTop: 6,
  },
  hintText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  learnButton: {
    marginRight: 6,
  },
  removeButton: {
    marginLeft: 6,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  actionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#0284c7',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#4b5563',
  },
  emptySubText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    color: '#6b7280',
    paddingHorizontal: 32,
  },
  infoContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  infoGradient: {
    borderRadius: 12,
  },
  infoCardContent: {
    padding: 20,
  },
  infoText: {
    marginBottom: 16,
    color: '#334155',
    fontSize: 15,
    textAlign: 'center',
  },
  scheduleButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scheduleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  scheduleIcon: {
    marginRight: 8,
  },
  scheduleButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  deleteAction: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: '100%',
    width: 80,
  },
  deleteActionGradient: {
    height: '92%',
    width: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 4,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0284c7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    minWidth: '80%',
  },
  toastText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 8,
  },
}); 