import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform, Modal, KeyboardAvoidingView, Animated, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { StorageService } from '@/app/services/StorageService';
import { NotificationService } from '@/app/services/NotificationService';
import { Word } from '@/app/models/Word';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

// Global fonksiyon için declare
declare global {
  var openNotificationModal: (() => void) | undefined;
}

export default function WordPoolScreen() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  // Kelime ekleme için state'ler
  const [addWordModalVisible, setAddWordModalVisible] = useState(false);
  const [newEnglishWord, setNewEnglishWord] = useState('');
  const [newTurkishWord1, setNewTurkishWord1] = useState('');
  const [newTurkishWord2, setNewTurkishWord2] = useState('');
  const [newTurkishWord3, setNewTurkishWord3] = useState('');
  // Kelime düzenleme için state'ler
  const [editWordModalVisible, setEditWordModalVisible] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [editEnglishWord, setEditEnglishWord] = useState('');
  const [editTurkishWord1, setEditTurkishWord1] = useState('');
  const [editTurkishWord2, setEditTurkishWord2] = useState('');
  const [editTurkishWord3, setEditTurkishWord3] = useState('');
  // Çift tıklama işlemi için gereken değişkenler
  const lastTapRef = useRef<number>(0);
  const DOUBLE_PRESS_DELAY = 300;
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Tıklama zamanlaması için timeout ref
  // Toast benzeri bildirim için state'ler
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Swipeable referansları için bir map objesi oluştur
  const swipeableRefs = useRef<{[key: string]: Swipeable | null}>({});
  // Bildirim ayarları modalı için state'ler
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [startHour, setStartHour] = useState('9');
  const [endHour, setEndHour] = useState('21');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  // Filtreleme için state'ler
  const [filterType, setFilterType] = useState<'all' | 'learned' | 'notLearned'>('all');

  // Global bildirim modal açma fonksiyonunu ayarla
  useEffect(() => {
    global.openNotificationModal = () => {
      setNotificationModalVisible(true);
    };
    
    return () => {
      global.openNotificationModal = undefined;
    };
  }, []);

  // Kelimeleri yükle
  const loadWords = async () => {
    try {
      setLoading(true);
      const allWords = await StorageService.getWords();
      setWords(allWords);
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

  // Yeni kelime ekle
  const addNewWord = async () => {
    if (!newEnglishWord.trim() || !newTurkishWord1.trim()) {
      Alert.alert('Hata', 'Lütfen İngilizce kelimeyi ve en az bir Türkçe anlam girin.');
      return;
    }

    try {
      // Türkçe anlamları birleştir (boş olmayanları)
      let turkishMeaning = newTurkishWord1.trim();
      
      // Diğer anlamlar varsa ekle (boş olmayanlar)
      if (newTurkishWord2.trim()) {
        turkishMeaning += "\n" + newTurkishWord2.trim();
      }
      
      if (newTurkishWord3.trim()) {
        turkishMeaning += "\n" + newTurkishWord3.trim();
      }

      await StorageService.addWord({
        english: newEnglishWord.trim(),
        turkish: turkishMeaning
      });
      
      setNewEnglishWord('');
      setNewTurkishWord1('');
      setNewTurkishWord2('');
      setNewTurkishWord3('');
      setAddWordModalVisible(false);
      
      loadWords();
      Alert.alert('Başarılı', 'Kelime başarıyla eklendi!');
    } catch (error) {
      Alert.alert('Hata', 'Kelime eklenirken bir hata oluştu.');
      console.error(error);
    }
  };

  // Kelimeyi düzenle
  const editWord = async () => {
    try {
      if (!editingWord) {
        Alert.alert('Hata', 'Düzenlenecek kelime bulunamadı. Lütfen tekrar deneyin.');
        return;
      }

      if (!editEnglishWord.trim() || !editTurkishWord1.trim()) {
        Alert.alert('Hata', 'Lütfen İngilizce kelimeyi ve en az bir Türkçe anlam girin.');
        return;
      }

      // Türkçe anlamları birleştir
      let turkishMeaning = '';
      
      if (editTurkishWord1.trim()) turkishMeaning = editTurkishWord1.trim();
      if (editTurkishWord2.trim()) turkishMeaning += "\n" + editTurkishWord2.trim();
      if (editTurkishWord3.trim()) turkishMeaning += "\n" + editTurkishWord3.trim();

      // Kelimeyi güncelle
      const updatedWord: Word = {
        ...editingWord,
        english: editEnglishWord.trim(),
        turkish: turkishMeaning
      };

      // Önce düzenleme modalını kapat
      setEditWordModalVisible(false);
      
      // Temizliği yap
      setEditingWord(null);
      setEditEnglishWord('');
      setEditTurkishWord1('');
      setEditTurkishWord2('');
      setEditTurkishWord3('');
      
      // Şimdi veritabanını güncelle
      await StorageService.updateWord(updatedWord);
      
      // En son kelimeleri yeniden yükle
      loadWords();
      
      Alert.alert('Başarılı', 'Kelime güncellendi.');
    } catch (error) {
      console.error('Kelime güncellenirken hata oluştu:', error);
      Alert.alert('Hata', 'Kelime güncellenirken bir sorun oluştu.');
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
              // StorageService'e kelime silme işlevi ekleyeceğiz, şimdilik tüm kelimeleri alıp, silinecek hariç geri kaydediyoruz
              const allWords = await StorageService.getWords();
              const filteredWords = allWords.filter(w => w.id !== wordId);
              await AsyncStorage.setItem('word_learner_words', JSON.stringify(filteredWords));
              loadWords();
              setModalVisible(false);
              Alert.alert('Başarılı', 'Kelime silindi.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Kelime silinirken hata oluştu:', error);
      Alert.alert('Hata', 'Kelime silinirken bir sorun oluştu.');
    }
  };

  // Kelimeyi öğrenildi/öğrenilmedi olarak işaretle
  const toggleLearned = async (word: Word, fromDoubleTap = false) => {
    try {
      // Önce yerel state'i güncelle (daha hızlı geri bildirim için)
      const updatedWords = words.map(w => {
        if (w.id === word.id) {
          if (w.isLearned) {
            // Öğrenildi işaretini kaldır
            return {
              ...w,
              isLearned: false,
              inNotificationPool: true
            };
          } else {
            // Öğrenildi olarak işaretle
            return {
              ...w,
              isLearned: true,
              inNotificationPool: false
            };
          }
        }
        return w;
      });
      
      // State'i hemen güncelle
      setWords(updatedWords);
      
      // Veritabanını güncelle (arkaplanda)
      if (word.isLearned) {
        // Öğrenildi işaretini kaldır
        const updatedWord = {
          ...word,
          isLearned: false,
          inNotificationPool: true
        };
        await StorageService.updateWord(updatedWord);
      } else {
        // Öğrenildi olarak işaretle
        await StorageService.markWordAsLearned(word.id);
      }
      
      // Eğer çift tıklamadan çağrılmadıysa ve bir modal açıksa modalı kapat
      if (!fromDoubleTap) {
        setModalVisible(false);
      }
    } catch (error) {
      console.error('Kelime durumu değiştirilirken hata oluştu:', error);
      // Hata durumunda kelimeleri tekrar yükle
      loadWords();
      
      // Kullanıcıya hata bildir (çift tıklamadaysa silent olsun)
      if (!fromDoubleTap) {
        Alert.alert('Hata', 'Kelime durumu değiştirilirken bir sorun oluştu.');
      }
    }
  };

  // Filtrelenmiş kelimeler
  const filteredWords = words.filter(word => {
    // Önce filtre tipine göre kontrol et
    if (filterType === 'learned' && !word.isLearned) {
      return false;
    }
    if (filterType === 'notLearned' && word.isLearned) {
      return false;
    }
    
    // Sonra arama metnine göre kontrol et
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const matchesSearch = 
        word.english.toLowerCase().includes(searchLower) ||
        word.turkish.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }
    
    return true;
  });

  // Kelime düzenleme için modalı göster
  const showEditModal = (word: Word) => {
    try {
      if (!word) {
        console.error('Düzenlenecek kelime bulunamadı');
        Alert.alert('Hata', 'Kelime bulunamadı, lütfen tekrar deneyin.');
        return;
      }

      // Önce detay modalını kapat
      setModalVisible(false);
      
      // Geçici bir kopya oluştur
      const wordCopy = {...word};
      
      // Birkaç saniye bekleyip düzenleme modalını aç
      setTimeout(() => {
        // State'leri güvenli bir şekilde ayarla
        if (wordCopy) {
          const meanings = wordCopy.turkish ? wordCopy.turkish.split('\n') : [];
          
          setEditingWord(wordCopy);
          setEditEnglishWord(wordCopy.english || '');
          setEditTurkishWord1(meanings.length > 0 ? meanings[0] : '');
          setEditTurkishWord2(meanings.length > 1 ? meanings[1] : '');
          setEditTurkishWord3(meanings.length > 2 ? meanings[2] : '');
          
          // Modalı aç
          setEditWordModalVisible(true);
        }
      }, 500); // Daha uzun bir gecikme kullan
    } catch (error) {
      console.error('Düzenleme modalı açılırken hata:', error);
      Alert.alert('Hata', 'Kelime düzenleme modalı açılamadı, lütfen tekrar deneyin.');
    }
  };

  // Kelime kartına tıklandığında modal'ı aç
  const openWordModal = (word: Word) => {
    setSelectedWord(word);
    setModalVisible(true);
  };

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
            
            // Haptic geri bildirim ekle
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
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

    // Kelime kartı için arka plan renklerini belirle - beyaz ağırlıklı
    const cardColors = item.isLearned 
      ? ['#ffffff', '#f0fdf4', '#dcfce7'] as const // Beyaz ağırlıklı, çok hafif yeşil ton - öğrenilmiş
      : item.inNotificationPool 
        ? ['#ffffff', '#f0f9ff', '#dbeafe'] as const // Beyaz ağırlıklı, çok hafif mavi ton - bildirim havuzunda
        : ['#ffffff', '#ffffff', '#ffffff'] as const; // Tamamen beyaz - normal
    
    // Türkçe anlamları satırlara ayır
    const turkishMeanings = item.turkish ? item.turkish.split('\n') : [];
    
    // Çift tıklama gerçekleştiğinde çalışacak fonksiyon
    const handleDoublePress = (word: Word) => {
      // Varsa önceki timeout'u temizle
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      
      // Haptic geri bildirim
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      console.log("Double tap detected! Toggling learned status for:", word.english);
      
      // Öğrenildi durumunu değiştir
      toggleLearned(word, true);
      
      // Toast mesajı
      const statusMessage = word.isLearned ? 
        `"${word.english}" tekrar öğrenilecekler listesine eklendi` : 
        `"${word.english}" öğrenildi olarak işaretlendi`;
        
      // Önceki toast'u temizle
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      
      // Yeni toast göster
      setToastMessage(statusMessage);
      setToastVisible(true);
      
      // Toast'u otomatik kapat
      toastTimeoutRef.current = setTimeout(() => {
        setToastVisible(false);
      }, 2000);
    };
    
    const CardContent = (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => {
          const now = Date.now();
          const lastTap = lastTapRef.current || 0;
          
          // Son tıklama zamanını güncelle
          lastTapRef.current = now;
          
          // İki tıklama arası süreyi kontrol et
          if (now - lastTap < DOUBLE_PRESS_DELAY) {
            // Çift tıklama algılandı
            handleDoublePress(item);
          }
          // Tek tıklamada modal açma işlemini kaldırdık
        }}
        onLongPress={() => {
          // Eğer bir timeout varsa temizle
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
          }
          
          // Haptic geri bildirim ekle
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          
          // Doğrudan kelimeyi düzenleme modalını aç
          showEditModal(item);
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
            <ThemedText style={[
              styles.englishWord, 
              item.isLearned ? styles.learnedText : null
            ]}>
              {item.english || "Kelime verisi yok!"}
            </ThemedText>
            
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
          {Platform.OS === 'ios' ? (
            <View style={styles.cardContainer}>
              {CardContent}
            </View>
          ) : (
            <View style={styles.cardContainer}>
              {CardContent}
            </View>
          )}
        </Swipeable>
      </View>
    );
  };

  // Kelime Ekleme Modal
  const renderAddWordModal = () => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={addWordModalVisible}
        onRequestClose={() => setAddWordModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Yeni Kelime Ekle</ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setAddWordModalVisible(false);
                  setNewEnglishWord('');
                  setNewTurkishWord1('');
                  setNewTurkishWord2('');
                  setNewTurkishWord3('');
                }}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>İngilizce</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="İngilizce kelime"
                  value={newEnglishWord}
                  onChangeText={setNewEnglishWord}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={[styles.inputContainer, { marginTop: 16 }]}>
                <ThemedText style={styles.inputLabel}>Türkçe Anlamları</ThemedText>
                
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="1. anlamı (zorunlu)"
                  value={newTurkishWord1}
                  onChangeText={setNewTurkishWord1}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
                
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="2. anlamı (isteğe bağlı)"
                  value={newTurkishWord2}
                  onChangeText={setNewTurkishWord2}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="3. anlamı (isteğe bağlı)"
                  value={newTurkishWord3}
                  onChangeText={setNewTurkishWord3}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.addWordButton, { opacity: !newEnglishWord.trim() || !newTurkishWord1.trim() ? 0.6 : 1 }]} 
                onPress={addNewWord}
                disabled={!newEnglishWord.trim() || !newTurkishWord1.trim()}
              >
                <MaterialIcons name="add" size={22} color="#FFF" />
                <ThemedText style={styles.addWordButtonText}>Kelime Ekle</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // Word Detail Modal
  const renderWordDetailModal = () => {
    if (!selectedWord) return null;
    
    const modalCardColors = selectedWord.isLearned 
      ? ['#f0fdf4', '#dcfce7'] as const
      : selectedWord.inNotificationPool 
        ? ['#f0f9ff', '#e0f2fe'] as const
        : ['#f8fafc', '#f1f5f9'] as const;

    // Türkçe anlamları satırlara ayır
    const turkishMeanings = selectedWord.turkish ? selectedWord.turkish.split('\n') : [];

    // Düzenleme butonuna tıklandığında çalışacak fonksiyon
    const handleEditPress = () => {
      if (!selectedWord) return;
      
      // Önce detay modalını kapat
      setModalVisible(false);
      
      // Verileri temizle
      setEditingWord(null);
      setEditEnglishWord('');
      setEditTurkishWord1('');
      setEditTurkishWord2('');
      setEditTurkishWord3('');
      
      // Zamanlayıcıyı ayarla
      setTimeout(() => {
        // Kelime bilgilerini ayarla
        const wordToEdit = {...selectedWord};
        const turkishArray = wordToEdit.turkish ? wordToEdit.turkish.split('\n') : [];
        
        setEditingWord(wordToEdit);
        setEditEnglishWord(wordToEdit.english || '');
        setEditTurkishWord1(turkishArray.length > 0 ? turkishArray[0] : '');
        setEditTurkishWord2(turkishArray.length > 1 ? turkishArray[1] : '');
        setEditTurkishWord3(turkishArray.length > 2 ? turkishArray[2] : '');
        
        // Düzenleme modalını aç
        setEditWordModalVisible(true);
      }, 500);
    };

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={[
                styles.modalTitle, 
                selectedWord.isLearned ? styles.learnedText : null
              ]}>
                {selectedWord.english}
              </ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <LinearGradient
                colors={modalCardColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalMeaningContainer}
              >
                {turkishMeanings.length > 0 ? (
                  <View>
                    {turkishMeanings.map((meaning, index) => (
                      <ThemedText 
                        key={index} 
                        style={[
                          styles.modalTurkishWord,
                          index > 0 ? { marginTop: 10 } : null
                        ]}
                      >
                        {`${index + 1}. ${meaning}`}
                      </ThemedText>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.modalTurkishWord}>
                    Anlam verisi yok!
                  </ThemedText>
                )}
              </LinearGradient>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[
                  styles.modalActionButton, 
                  selectedWord.isLearned ? styles.orangeButton : styles.greenButton
                ]} 
                onPress={() => toggleLearned(selectedWord)}
              >
                <MaterialIcons 
                  name={selectedWord.isLearned ? "refresh" : "check"} 
                  size={18} 
                  color="#FFF" 
                />
                <ThemedText style={styles.modalActionText}>
                  {selectedWord.isLearned ? "Tekrar" : "Öğrendim"}
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalActionButton, styles.blueButton]} 
                onPress={handleEditPress}
              >
                <MaterialIcons name="edit" size={18} color="#FFF" />
                <ThemedText style={styles.modalActionText}>Düzenle</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalActionButton, styles.redButton]} 
                onPress={() => deleteWord(selectedWord.id)}
              >
                <MaterialIcons name="delete" size={18} color="#FFF" />
                <ThemedText style={styles.modalActionText}>Sil</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Kelime Düzenleme Modal
  const renderEditWordModal = () => {
    // Basit bir kapatma fonksiyonu
    const closeModal = () => {
      // Önce modalı kapat
      setEditWordModalVisible(false);
      
      // Sonra temizliği yap
      setEditingWord(null);
      setEditEnglishWord('');
      setEditTurkishWord1('');
      setEditTurkishWord2('');
      setEditTurkishWord3('');
    };
    
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={editWordModalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Kelimeyi Düzenle</ThemedText>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeModal}
              >
                <MaterialIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>İngilizce</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="İngilizce kelime"
                  value={editEnglishWord}
                  onChangeText={setEditEnglishWord}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
              
              <View style={[styles.inputContainer, { marginTop: 16 }]}>
                <ThemedText style={styles.inputLabel}>Türkçe Anlamları</ThemedText>
                
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="1. anlamı (zorunlu)"
                  value={editTurkishWord1}
                  onChangeText={setEditTurkishWord1}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
                
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="2. anlamı (isteğe bağlı)"
                  value={editTurkishWord2}
                  onChangeText={setEditTurkishWord2}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
                
                <TextInput
                  style={styles.input}
                  placeholder="3. anlamı (isteğe bağlı)"
                  value={editTurkishWord3}
                  onChangeText={setEditTurkishWord3}
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.addWordButton, { opacity: !editEnglishWord.trim() || !editTurkishWord1.trim() ? 0.6 : 1 }]} 
                onPress={editWord}
                disabled={!editEnglishWord.trim() || !editTurkishWord1.trim()}
              >
                <MaterialIcons name="save" size={22} color="#FFF" />
                <ThemedText style={styles.addWordButtonText}>Kaydet</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Bildirim ayarları modalı
  const renderNotificationSettingsModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={notificationModalVisible}
        onRequestClose={() => setNotificationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notificationModalContainer}>
            <View style={styles.notificationModalHeader}>
              <ThemedText style={styles.notificationModalTitle}>Bildirim Ayarları</ThemedText>
              <TouchableOpacity 
                onPress={() => setNotificationModalVisible(false)}
                style={styles.notificationCloseButton}
              >
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.notificationDivider} />
            
            <View style={styles.notificationRow}>
              <ThemedText style={styles.notificationLabel}>Bildirimler</ThemedText>
              <Switch
                trackColor={{ false: "#cbd5e1", true: "#0284c7" }}
                thumbColor={"#f8fafc"}
                ios_backgroundColor="#cbd5e1"
                onValueChange={() => {
                  // Haptic feedback
                  if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setNotificationsEnabled(!notificationsEnabled);
                }}
                value={notificationsEnabled}
              />
            </View>
            
            <View style={styles.hoursContainer}>
              <View style={styles.hourInputBox}>
                <ThemedText style={styles.hourInputLabel}>Başlangıç Saati</ThemedText>
                <TextInput
                  style={styles.hourInputField}
                  keyboardType="numeric"
                  value={startHour}
                  onChangeText={setStartHour}
                  maxLength={2}
                  placeholderTextColor="#94a3b8"
                />
              </View>
              
              <View style={styles.hourInputBox}>
                <ThemedText style={styles.hourInputLabel}>Bitiş Saati</ThemedText>
                <TextInput
                  style={styles.hourInputField}
                  keyboardType="numeric"
                  value={endHour}
                  onChangeText={setEndHour}
                  maxLength={2}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            
            <TouchableOpacity style={styles.saveButton} onPress={saveNotificationSettings}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                <ThemedText style={styles.saveButtonText}>Ayarları Kaydet</ThemedText>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.testButton} onPress={sendTestNotification}>
              <LinearGradient
                colors={['#f97316', '#ea580c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.testButtonGradient}
              >
                <ThemedText style={styles.testButtonText}>Test Bildirimi Gönder</ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };
  
  // Bildirim ayarlarını kaydet
  const saveNotificationSettings = async () => {
    try {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      const startHourNum = parseInt(startHour, 10);
      const endHourNum = parseInt(endHour, 10);
      
      if (isNaN(startHourNum) || isNaN(endHourNum) || startHourNum < 0 || startHourNum > 23 || endHourNum < 0 || endHourNum > 23) {
        showToast('Lütfen saat değerlerini 0-23 arasında girin.');
        return;
      }
      
      if (startHourNum >= endHourNum) {
        showToast('Başlangıç saati, bitiş saatinden küçük olmalıdır.');
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
        showToast('Bildirim ayarları kaydedildi ve bildirimler güncellendi.');
      } else {
        await NotificationService.cancelAllScheduledNotifications();
        showToast('Bildirimler devre dışı bırakıldı.');
      }
      
      setNotificationModalVisible(false);
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata oluştu:', error);
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  // Test bildirimi gönder
  const sendTestNotification = async () => {
    try {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      const notificationId = await NotificationService.scheduleRandomNotificationForTesting();
      if (notificationId) {
        showToast('5 saniye içinde test bildirimi alacaksınız.');
      } else {
        showToast('Bildirim havuzunda kelime bulunmuyor.');
      }
    } catch (error) {
      console.error('Test bildirimi gönderilirken hata oluştu:', error);
      Alert.alert('Hata', 'Test bildirimi gönderilirken bir hata oluştu.');
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
      
      {/* Filtreleme Seçenekleri - Görseldeki gibi sade oval butonlar */}
      <View style={styles.filterOptionsContainer}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            filterType === 'all' && styles.activeFilterChip
          ]}
          onPress={() => {
            setFilterType('all');
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <MaterialIcons
            name="list"
            size={16}
            color={filterType === 'all' ? '#0284c7' : '#64748b'}
          />
          <ThemedText
            style={[
              styles.filterChipText,
              filterType === 'all' && styles.activeFilterChipText
            ]}
          >
            Tümü
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filterType === 'learned' && styles.activeFilterChip
          ]}
          onPress={() => {
            setFilterType('learned');
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <MaterialIcons
            name="check-circle"
            size={16}
            color={filterType === 'learned' ? '#0284c7' : '#64748b'}
          />
          <ThemedText
            style={[
              styles.filterChipText,
              filterType === 'learned' && styles.activeFilterChipText
            ]}
          >
            Öğrenilmiş
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filterType === 'notLearned' && styles.activeFilterChip
          ]}
          onPress={() => {
            setFilterType('notLearned');
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }}
        >
          <MaterialIcons
            name="refresh"
            size={16}
            color={filterType === 'notLearned' ? '#0284c7' : '#64748b'}
          />
          <ThemedText
            style={[
              styles.filterChipText,
              filterType === 'notLearned' && styles.activeFilterChipText
            ]}
          >
            Öğrenilmemiş
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* Filtre sonuçları göstergesi */}
      {filteredWords.length > 0 && (
        <View style={styles.filterResultsHeader}>
          <View style={styles.filterResultsTextContainer}>
            <MaterialIcons name="filter-list" size={16} color="#0284c7" />
            <ThemedText style={styles.filterResultsText}>
              {filteredWords.length} kelime bulundu
            </ThemedText>
          </View>
        </View>
      )}
      
      {/* Sonuçlar başlığı kaldırıldı, sadece liste görünecek */}
      {loading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0284c7" />
          <ThemedText style={styles.loadingText}>Kelimeler yükleniyor...</ThemedText>
        </View>
      ) : filteredWords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="info" size={48} color="#9ca3af" />
          {searchText ? (
            <ThemedText style={styles.emptyText}>Arama sonucu bulunamadı.</ThemedText>
          ) : (
            <ThemedText style={styles.emptyText}>Henüz kelime eklenmemiş.</ThemedText>
          )}
          {!searchText && (
            <ThemedText style={styles.emptySubText}>
              Sağ alttaki + butonuna tıklayarak kelime ekleyebilirsiniz.
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
        />
      )}
      
      {/* Yeni kelime ekleme floating butonu */}
      <TouchableOpacity
        style={styles.floatingButton}
        activeOpacity={0.8}
        onPress={() => setAddWordModalVisible(true)}
      >
        <MaterialIcons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      
      {renderWordDetailModal()}
      {renderAddWordModal()}
      {renderEditWordModal()}
      {renderToast()}
      {renderNotificationSettingsModal()}
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
  englishWord: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 6,
  },
  turkishWord: {
    fontSize: 16,
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  learnedText: {
    color: '#10b981',
    fontWeight: 'bold',
    textShadowColor: 'rgba(16, 185, 129, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  wordStatus: {
    display: 'none',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  greenButton: {
    backgroundColor: '#10b981',
  },
  blueButton: {
    backgroundColor: '#3b82f6',
  },
  redButton: {
    backgroundColor: '#ef4444',
  },
  orangeButton: {
    backgroundColor: '#f97316',
  },
  listContent: {
    paddingBottom: 32,
    paddingHorizontal: 2,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: 20,
    paddingTop: 10,
  },
  modalMeaningContainer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 0,
  },
  modalTurkishWord: {
    fontSize: 18,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modalActionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  // Floating Button Styles
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  // Add Word Modal Styles
  inputContainer: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    height: 50,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#334155',
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  addWordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addWordButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  turkishMeaningsContainer: {
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
  filterOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flex: 1,
    marginHorizontal: 3,
  },
  activeFilterChip: {
    backgroundColor: '#e0f2fe',
    borderColor: '#bae6fd',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
    color: '#64748b',
  },
  activeFilterChipText: {
    color: '#0284c7',
    fontWeight: 'bold',
  },
  filterResultsHeader: {
    paddingHorizontal: 4,
    paddingBottom: 4,
    marginTop: 2,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterResultsTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterResultsText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 4,
  },
  notificationModalContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  notificationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  notificationModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  notificationCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  notificationLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  hoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginVertical: 15,
  },
  hourInputBox: {
    width: '45%',
  },
  hourInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  hourInputField: {
    height: 48,
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 18,
    textAlign: 'center',
    color: '#334155',
    paddingHorizontal: 10,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  testButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  testButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 