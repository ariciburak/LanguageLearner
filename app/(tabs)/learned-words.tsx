import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { StorageService } from '@/app/services/StorageService';
import { Word } from '@/app/models/Word';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function LearnedWordsScreen() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Kelimeleri yükle
  const loadWords = async () => {
    try {
      setLoading(true);
      const allWords = await StorageService.getWords();
      // Sadece öğrenilmiş kelimeleri filtrele
      const learnedWords = allWords.filter(word => word.isLearned);
      setWords(learnedWords);
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

  // Kelimeyi tekrar öğrenilmedi olarak işaretle ve bildirim havuzuna ekle
  const moveToNotificationPool = async (word: Word) => {
    try {
      const updatedWord = {
        ...word,
        isLearned: false,
        inNotificationPool: true
      };
      await StorageService.updateWord(updatedWord);
      loadWords();
      Alert.alert('Başarılı', 'Kelime bildirim havuzuna eklendi.');
    } catch (error) {
      console.error('Kelime durumu değiştirilirken hata oluştu:', error);
      Alert.alert('Hata', 'Kelime durumu değiştirilirken bir sorun oluştu.');
    }
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
  const renderWordItem = (word: Word) => {
    const CardContent = (
      <View style={styles.wordItemContent}>
        <View style={styles.wordHeader}>
          <ThemedText style={styles.englishWord}>{word.english}</ThemedText>
          <View style={styles.statusBadge}>
            <MaterialIcons name="done-all" size={14} color="#FFF" />
            <ThemedText style={styles.statusText}>Öğrenildi</ThemedText>
          </View>
        </View>
        
        <ThemedText style={styles.turkishWord}>{word.turkish}</ThemedText>
        
        <View style={styles.wordActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => moveToNotificationPool(word)}
          >
            <LinearGradient
              colors={['#f97316', '#ea580c', '#c2410c']}
              style={styles.actionButtonGradient}
            >
              <MaterialIcons name="refresh" size={20} color="#FFF" />
              <ThemedText style={styles.actionText}>Tekrar Çalış</ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <View style={styles.wordItem}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint="light" style={styles.blurCard}>
            {CardContent}
          </BlurView>
        ) : (
          <View style={styles.androidCard}>
            {CardContent}
          </View>
        )}
      </View>
    );
  };

  // Kelime grubu başlığı (tarih bazlı gruplandırma için)
  const renderGroupHeader = (date: string) => {
    const HeaderContent = (
      <View style={styles.groupHeaderContent}>
        <MaterialIcons name="event" size={18} color="#0284c7" />
        <ThemedText style={styles.groupHeaderText}>{date}</ThemedText>
      </View>
    );

    return (
      <View style={styles.groupHeader}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint="light" style={styles.blurHeaderCard}>
            {HeaderContent}
          </BlurView>
        ) : (
          <View style={styles.androidHeaderCard}>
            {HeaderContent}
          </View>
        )}
      </View>
    );
  };

  // Kelimeleri gruplama fonksiyonları
  const groupWordsByDate = (wordList: Word[]) => {
    const groups: { [key: string]: Word[] } = {};
    
    wordList.forEach(word => {
      const date = new Date(word.createdAt);
      const dateString = date.toLocaleDateString('tr-TR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      
      groups[dateString].push(word);
    });
    
    return groups;
  };

  const groupedWords = groupWordsByDate(filteredWords);
  const dateKeys = Object.keys(groupedWords).sort((a, b) => {
    // En son eklenen grup en üstte olacak şekilde sırala
    return new Date(b).getTime() - new Date(a).getTime();
  });

  // Alternatif liste işleme, gruplar halinde
  const renderGroupedContent = () => {
    if (dateKeys.length === 0) return null;

    return (
      <FlatList
        data={dateKeys}
        keyExtractor={(item) => item}
        renderItem={({ item: dateKey }) => (
          <View>
            {renderGroupHeader(dateKey)}
            {groupedWords[dateKey].map(word => (
              <View key={word.id}>
                {renderWordItem(word)}
              </View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshing={isRefreshing}
        onRefresh={() => {
          setIsRefreshing(true);
          loadWords();
        }}
        ListFooterComponent={renderInfoCard}
      />
    );
  };

  // Bilgi kartı
  const renderInfoCard = () => {
    const CardContent = (
      <View style={styles.infoCardContent}>
        <ThemedText style={styles.infoText}>
          Bu sayfada öğrendiğiniz kelimeleri görebilirsiniz. "Tekrar Çalış" düğmesine basarak kelimeleri tekrar bildirim havuzuna ekleyebilirsiniz.
        </ThemedText>
      </View>
    );

    return (
      <View style={styles.infoContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint="light" style={styles.blurCard}>
            {CardContent}
          </BlurView>
        ) : (
          <View style={styles.androidCard}>
            {CardContent}
          </View>
        )}
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
          <MaterialIcons name="done-all" size={48} color="#9ca3af" />
          {searchText ? (
            <ThemedText style={styles.emptyText}>Arama sonucu bulunamadı.</ThemedText>
          ) : (
            <ThemedText style={styles.emptyText}>Henüz öğrenilen kelime yok.</ThemedText>
          )}
          {!searchText && (
            <ThemedText style={styles.emptySubText}>
              Bildirim havuzundaki kelimeleri öğrendiğinizde burada görüntülenecek.
            </ThemedText>
          )}
        </View>
      ) : renderGroupedContent()}
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
    marginBottom: 12,
  },
  blurCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  androidCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  wordItemContent: {
    padding: 20,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  englishWord: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    flex: 1,
  },
  turkishWord: {
    fontSize: 16,
    marginBottom: 16,
    color: '#64748b',
  },
  statusBadge: {
    backgroundColor: '#16a34a',
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
  wordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    width: '40%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  groupHeader: {
    marginVertical: 8,
  },
  blurHeaderCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  androidHeaderCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(241,245,249,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.5)',
  },
  groupHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  groupHeaderText: {
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#334155',
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
  infoCardContent: {
    padding: 20,
  },
  infoText: {
    color: '#334155',
    fontSize: 15,
    textAlign: 'center',
  },
}); 