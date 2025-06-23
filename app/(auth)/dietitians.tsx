// app/(auth)/dietitians.tsx
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/layouts/MainLayout';
import { UserService } from '@/services/userService';
import { User } from '@/types/user';
import { db } from '@/utils/firebase';

// Define message interface
interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderType: 'user' | 'dietitian';
  timestamp: Timestamp;
  read: boolean;
}

// Define chat interface
interface Chat {
  id: string;
  userId: string;
  dietitianId: string;
  status: 'waiting' | 'active' | 'closed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: string;
}

export default function Dietitians() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dietitians, setDietitians] = useState<User[]>([]);
  const { theme } = useTheme();
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedDietitian, setSelectedDietitian] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [waitingForDietitian, setWaitingForDietitian] = useState(false);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  
  // Ref for unsubscribing from Firestore listeners
  const unsubscribeRef = useRef<() => void | null>();
  
  // Ref for auto-scrolling to bottom of chat
  const messagesEndRef = useRef<FlatList>(null);

  useEffect(() => {
    if (user?.uid) {
      loadDietitians();
    }
    
    // Clean up any listeners when component unmounts
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.uid]);

  const loadDietitians = async () => {
    try {
      setLoading(true);
      console.log('👨‍⚕️ Loading dietitians...');
      const dietitiansData = await UserService.getDietitians();
      console.log('✅ Loaded dietitians:', dietitiansData.length);
      setDietitians(dietitiansData);
    } catch (error) {
      console.error('❌ Error loading dietitians:', error);
      Alert.alert('Error', 'Failed to load dietitians');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (route: string) => {
    console.log('Navigating to:', route);
    switch (route) {
      case 'dashboard':
        router.push('/(auth)/dashboard');
        break;
      case 'nutrition':
        router.push('/(auth)/nutrition');
        break;
      case 'workouts':
        router.push('/(auth)/workouts');
        break;
      case 'sleep':
        router.push('/(auth)/sleep');
        break;
      case 'hydration':
        router.push('/(auth)/hydration');
        break;
      case 'dietitians':
        // Already on dietitians page
        break;
      case 'settings':
        router.push('/(auth)/settings');
        break;
      default:
        console.log('Unknown route:', route);
        Alert.alert('Navigation Error', `Route "${route}" not found`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // Check if a chat already exists with this dietitian
  const findExistingChat = async (dietitianId: string): Promise<Chat | null> => {
    if (!user?.uid) return null;
    
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('userId', '==', user.uid),
        where('dietitianId', '==', dietitianId),
        where('status', 'in', ['waiting', 'active'])
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      // Return the first active chat found
      const chatDoc = querySnapshot.docs[0];
      return {
        id: chatDoc.id,
        ...chatDoc.data()
      } as Chat;
      
    } catch (error) {
      console.error('Error finding existing chat:', error);
      return null;
    }
  };

  // Create a new chat with the dietitian
  const createNewChat = async (dietitianId: string): Promise<Chat | null> => {
    if (!user?.uid) return null;
    
    try {
      const chatsRef = collection(db, 'chats');
      const newChatRef = await addDoc(chatsRef, {
        userId: user.uid,
        dietitianId: dietitianId,
        status: 'waiting',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: 'Chat started'
      });
      
      // Get the newly created chat
      const chatDoc = await getDoc(newChatRef);
      
      if (!chatDoc.exists()) {
        throw new Error('Failed to create chat');
      }
      
      return {
        id: chatDoc.id,
        ...chatDoc.data()
      } as Chat;
      
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  // Subscribe to chat messages
  const subscribeToChatMessages = (chatId: string) => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    // Unsubscribe from any existing listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    
    // Set up new listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages: ChatMessage[] = [];
      
      snapshot.forEach((doc) => {
        messages.push({
          id: doc.id,
          ...doc.data()
        } as ChatMessage);
      });
      
      setChatMessages(messages);
      
      // Mark messages as read if they're from the dietitian
      messages.forEach(async (msg) => {
        if (msg.senderType === 'dietitian' && !msg.read) {
          const messageRef = doc(db, 'chats', chatId, 'messages', msg.id);
          await updateDoc(messageRef, { read: true });
        }
      });
    });
    
    unsubscribeRef.current = unsubscribe;
  };

  // Also subscribe to chat status changes
  const subscribeToChatStatus = (chatId: string) => {
    const chatRef = doc(db, 'chats', chatId);
    
    const unsubscribe = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const chatData = snapshot.data() as Chat;
        setCurrentChat({
          id: snapshot.id,
          ...chatData
        });
        
        // Update waiting status based on chat status
        setWaitingForDietitian(chatData.status === 'waiting');
      }
    });
    
    // Combine with existing unsubscribe function
    const previousUnsubscribe = unsubscribeRef.current;
    unsubscribeRef.current = () => {
      if (previousUnsubscribe) previousUnsubscribe();
      unsubscribe();
    };
  };

  // Send a message in the chat
  const sendChatMessage = async () => {
    if (!user?.uid || !currentChat || !message.trim()) return;
    
    try {
      setSendingMessage(true);
      
      const messagesRef = collection(db, 'chats', currentChat.id, 'messages');
      await addDoc(messagesRef, {
        text: message.trim(),
        senderId: user.uid,
        senderType: 'user',
        timestamp: serverTimestamp(),
        read: false
      });
      
      // Update the chat's last message and timestamp
      const chatRef = doc(db, 'chats', currentChat.id);
      await updateDoc(chatRef, {
        lastMessage: message.trim(),
        updatedAt: serverTimestamp()
      });
      
      // Clear the input
      setMessage('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Open chat with a dietitian
  const openChat = async (dietitian: User) => {
    if (!user?.uid || !dietitian.id) {
      Alert.alert('Error', 'Cannot start chat at this time');
      return;
    }
    
    try {
      setLoadingChat(true);
      setSelectedDietitian(dietitian);
      setShowChatModal(true);
      
      // Find existing chat or create a new one
      let chat = await findExistingChat(dietitian.id);
      
      if (!chat) {
        chat = await createNewChat(dietitian.id);
      }
      
      if (!chat) {
        throw new Error('Failed to create or find chat');
      }
      
      setCurrentChat(chat);
      setWaitingForDietitian(chat.status === 'waiting');
      
      // Subscribe to chat messages and status changes
      subscribeToChatMessages(chat.id);
      subscribeToChatStatus(chat.id);
      
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Failed to open chat');
      setShowChatModal(false);
    } finally {
      setLoadingChat(false);
    }
  };

  // Close the chat
  const closeChat = () => {
    // Unsubscribe from Firestore listeners
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = undefined;
    }
    
    setShowChatModal(false);
    setSelectedDietitian(null);
    setCurrentChat(null);
    setChatMessages([]);
    setMessage('');
  };

  const renderTag = (text: string, type: 'expertise' | 'diet') => {
    const colors = {
      expertise: {
        bg: theme.mode === 'dark' ? '#1E3A8A' : '#DBEAFE',
        text: theme.mode === 'dark' ? '#93C5FD' : '#1E40AF'
      },
      diet: {
        bg: theme.mode === 'dark' ? '#064E3B' : '#DCFCE7',
        text: theme.mode === 'dark' ? '#6EE7B7' : '#047857'
      }
    };
    
    return (
      <View key={text} style={[styles.tag, { backgroundColor: colors[type].bg }]}>
        <ThemedText style={[styles.tagText, { color: colors[type].text }]}>{text}</ThemedText>
      </View>
    );
  };

  const getProfilePhoto = (item: User) => {
    // First check if there's a profile_photo in the profile
    if (item.profile && item.profile.profile_photo) {
      return item.profile.profile_photo;
    }
    
    // Fall back to photoURL if profile_photo doesn't exist
    if (item.photoURL) {
      return item.photoURL;
    }
    
    // Return null if no photo is available
    return null;
  };

  const renderDietitian = ({ item }: { item: User }) => {
    const profilePhoto = getProfilePhoto(item);
    const areasOfExpertise = item.profile?.areasOfExpertise || [];
    const dietApproaches = item.profile?.dietApproaches || [];
    
    return (
      <ThemedView style={[styles.card, { backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#FFFFFF' }]}>
      <View style={styles.cardHeader}>
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.avatar} />
        ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.mode === 'dark' ? '#4B5563' : '#D1D5DB' }]}>
              <IconSymbol name="person.fill" size={24} color={theme.mode === 'dark' ? '#E5E7EB' : '#6B7280'} />
          </View>
        )}
        <View style={styles.cardHeaderText}>
            <ThemedText type="subtitle" style={{ color: theme.text }}>
              {item.displayName || item.profile?.name || 'Dietitian'}
            </ThemedText>
            <ThemedText style={[styles.email, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
              {item.email}
            </ThemedText>
          </View>
      </View>
      
        <ThemedView style={[styles.divider, { backgroundColor: theme.mode === 'dark' ? '#374151' : '#E5E7EB' }]} />
      
      <View style={styles.cardDetails}>
          <View style={styles.sectionContainer}>
            <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: theme.mode === 'dark' ? '#93C5FD' : '#2563EB' }]}>
              Areas of Expertise
            </ThemedText>
            {areasOfExpertise.length > 0 ? (
              <View style={styles.tagsContainer}>
                {areasOfExpertise.map(area => renderTag(area, 'expertise'))}
              </View>
            ) : (
              <ThemedText style={[styles.noDataText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                No expertise areas specified
              </ThemedText>
            )}
          </View>
          
          <View style={styles.sectionContainer}>
            <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: theme.mode === 'dark' ? '#6EE7B7' : '#059669' }]}>
              Diet Approaches
            </ThemedText>
            {dietApproaches.length > 0 ? (
              <View style={styles.tagsContainer}>
                {dietApproaches.map(approach => renderTag(approach, 'diet'))}
              </View>
            ) : (
              <ThemedText style={[styles.noDataText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                No diet approaches specified
              </ThemedText>
            )}
        </View>
        
          <TouchableOpacity 
            style={[styles.chatButton, { backgroundColor: theme.mode === 'dark' ? '#047857' : '#10B981' }]}
            onPress={() => openChat(item)}
          >
            <IconSymbol name="chat.bubble.text.fill" size={18} color="#FFFFFF" />
            <ThemedText style={styles.chatButtonText}>Chat Now</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.senderType === 'user';
    const messageDate = item.timestamp instanceof Timestamp 
      ? item.timestamp.toDate() 
      : new Date();
      
    return (
      <View 
        style={[
          styles.messageContainer, 
          isUser ? styles.userMessageContainer : styles.dietitianMessageContainer
        ]}
      >
        <View 
          style={[
            styles.messageBubble, 
            isUser 
              ? { backgroundColor: theme.mode === 'dark' ? '#075985' : '#3B82F6' } 
              : { backgroundColor: theme.mode === 'dark' ? '#065F46' : '#10B981' }
          ]}
        >
          <ThemedText style={styles.messageText}>{item.text}</ThemedText>
        </View>
        <ThemedText style={styles.messageTime}>
          {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </View>
    );
  };

  const renderChatModal = () => (
    <Modal
      visible={showChatModal}
      animationType="slide"
      transparent={true}
      onRequestClose={closeChat}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.chatContainer, { backgroundColor: theme.mode === 'dark' ? '#111827' : '#FFFFFF' }]}>
          {/* Chat Header */}
          <View style={[styles.chatHeader, { backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#F3F4F6' }]}>
            {selectedDietitian && (
              <View style={styles.chatHeaderContent}>
                <View style={styles.chatHeaderLeft}>
                  {getProfilePhoto(selectedDietitian) ? (
                    <Image source={{ uri: getProfilePhoto(selectedDietitian) }} style={styles.chatAvatar} />
                  ) : (
                    <View style={[styles.chatAvatarPlaceholder, { backgroundColor: theme.mode === 'dark' ? '#4B5563' : '#D1D5DB' }]}>
                      <IconSymbol name="person.fill" size={16} color={theme.mode === 'dark' ? '#E5E7EB' : '#6B7280'} />
                    </View>
                  )}
                  <View>
                    <ThemedText style={[styles.chatHeaderName, { color: theme.text }]}>
                      {selectedDietitian.displayName || selectedDietitian.profile?.name || 'Dietitian'}
                    </ThemedText>
                    <ThemedText style={[styles.chatHeaderStatus, { color: waitingForDietitian ? '#F59E0B' : '#10B981' }]}>
                      {waitingForDietitian ? 'Waiting to join...' : 'Online'}
                    </ThemedText>
                  </View>
                </View>
                <TouchableOpacity onPress={closeChat} style={styles.closeButton}>
                  <IconSymbol name="xmark" size={20} color={theme.mode === 'dark' ? '#D1D5DB' : '#6B7280'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Waiting State - Show loading indicator */}
          {waitingForDietitian && (
            <View style={styles.waitingContainer}>
              <ActivityIndicator size="large" color={theme.mode === 'dark' ? '#93C5FD' : '#3B82F6'} />
              <ThemedText style={[styles.waitingText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                Waiting for dietitian to join...
              </ThemedText>
              <ThemedText style={[styles.waitingSubtext, { color: theme.mode === 'dark' ? '#6B7280' : '#9CA3AF' }]}>
                You'll be connected shortly
              </ThemedText>
            </View>
          )}
          
          {/* Chat Messages */}
          {!waitingForDietitian && !loadingChat && (
            <View style={styles.chatMessages}>
              {chatMessages.length === 0 ? (
                <View style={styles.emptyChatContainer}>
                  <IconSymbol name="chat.bubble.text" size={48} color={theme.mode === 'dark' ? '#4B5563' : '#D1D5DB'} />
                  <ThemedText style={[styles.emptyChatText, { color: theme.mode === 'dark' ? '#9CA3AF' : '#6B7280' }]}>
                    Start the conversation by sending a message
                  </ThemedText>
                </View>
              ) : (
                <FlatList
                  ref={messagesEndRef}
                  data={chatMessages}
                  renderItem={renderChatMessage}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.messagesContainer}
                  onContentSizeChange={() => {
                    messagesEndRef.current?.scrollToEnd({ animated: true });
                  }}
                />
              )}
            </View>
          )}
          
          {/* Chat Input - only show if chat is active */}
          {currentChat?.status === 'active' && (
            <View style={[styles.chatInputContainer, { backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#F3F4F6' }]}>
              <TextInput
                style={[
                  styles.chatInput,
                  { 
                    backgroundColor: theme.mode === 'dark' ? '#374151' : '#FFFFFF',
                    color: theme.text,
                    borderColor: theme.mode === 'dark' ? '#4B5563' : '#E5E7EB'
                  }
                ]}
                placeholder="Type your message..."
                placeholderTextColor={theme.mode === 'dark' ? '#9CA3AF' : '#9CA3AF'}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                editable={!waitingForDietitian && !loadingChat && !sendingMessage}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton, 
                  { 
                    backgroundColor: theme.mode === 'dark' ? '#047857' : '#10B981',
                    opacity: waitingForDietitian || !message.trim() || sendingMessage ? 0.5 : 1
                  }
                ]}
                onPress={sendChatMessage}
                disabled={waitingForDietitian || !message.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <ProtectedRoute>
      <MainLayout 
        title="Dietitians" 
        activeRoute="dietitians"
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        user={{
          name: user?.displayName || '',
          email: user?.email || '',
          photoURL: user?.photoURL || '',
        }}
      >
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <ThemedText type="title" style={[styles.pageTitle, { color: theme.text }]}>
            Dietitians
          </ThemedText>
          <ThemedText style={[styles.description, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
            All registered dietitians in the system
          </ThemedText>
          
          {loading ? (
            <ActivityIndicator size="large" color={theme.mode === 'dark' ? '#93C5FD' : '#3B82F6'} style={styles.loader} />
          ) : dietitians.length > 0 ? (
            <FlatList
              data={dietitians}
              renderItem={renderDietitian}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <ThemedView style={[styles.emptyState, { backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#F9FAFB' }]}>
              <IconSymbol name="person.slash" size={48} color={theme.mode === 'dark' ? '#9CA3AF' : '#6B7280'} />
              <ThemedText style={[styles.emptyText, { color: theme.mode === 'dark' ? '#D1D5DB' : '#6B7280' }]}>
                No dietitians found
              </ThemedText>
              <TouchableOpacity 
                style={[styles.refreshButton, { backgroundColor: theme.mode === 'dark' ? '#2563EB' : '#3B82F6' }]} 
                onPress={loadDietitians}
              >
                <ThemedText style={styles.refreshText}>Refresh</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
          
          {renderChatModal()}
        </View>
      </MainLayout>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  pageTitle: {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    marginBottom: 16,
    fontSize: 16,
  },
  loader: {
    marginVertical: 32,
  },
  listContainer: {
    paddingBottom: 20,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  cardHeaderText: {
    marginLeft: 16,
    flex: 1,
  },
  email: {
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  cardDetails: {
    gap: 20,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  noDataText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
  },
  refreshButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  refreshText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContainer: {
    width: '90%',
    height: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  chatHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#10B981',
  },  chatAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  chatHeaderName: {
    fontWeight: '600',
    fontSize: 16,
  },
  chatHeaderStatus: {
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  chatMessages: {
    flex: 1,
    padding: 12,
  },
  messagesContainer: {
    paddingBottom: 12,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  dietitianMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
    alignSelf: 'flex-end',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  waitingText: {
    fontSize: 16,
    textAlign: 'center',
  },
  waitingSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyChatText: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  }
});
