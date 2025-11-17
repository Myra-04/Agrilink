import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, FlatList, SafeAreaView } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from './supabase'; 

export default function App() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data, error } = await supabase.from('jobs').select('*');
    if (data) setJobs(data);
  };

  // --- NEW FUNCTION: HANDLES THE APPLICATION ---
  const handleApply = async (jobTitle, jobId) => {
    Alert.alert(
      "Apply for Job",
      `Do you want to apply for ${jobTitle}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            // Send data to Supabase
            const { error } = await supabase
              .from('applications')
              .insert({ job_id: jobId, applicant_name: 'Guest Worker' });

            if (error) Alert.alert("Error", error.message);
            else Alert.alert("Success", "Application Sent! The farmer will contact you.");
          } 
        }
      ]
    );
  };

  const renderJob = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.jobTitle}>{item.title}</Text>
          <Text style={styles.jobLocation}>📍 {item.location}</Text>
        </View>
        <Text style={styles.payTag}>{item.pay_rate}</Text>
      </View>
      <Text style={styles.jobDesc}>{item.description}</Text>
      
      {/* BUTTON NOW HAS AN ACTION */}
      <TouchableOpacity 
        style={styles.applyButton}
        onPress={() => handleApply(item.title, item.id)} 
      >
        <Text style={styles.applyButtonText}>Apply Now</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Welcome to AgriLink</Text>
          <Text style={styles.heroSubtitle}>Connecting farmers and workers.</Text>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>Recent Jobs</Text>
          <FlatList
            data={jobs}
            renderItem={renderJob}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false} 
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F2' },
  hero: { backgroundColor: '#2E5834', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20, borderBottomRightRadius: 30, borderBottomLeftRadius: 30 },
  heroTitle: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  heroSubtitle: { fontSize: 16, color: '#D0E8D4', marginBottom: 25 },
  listSection: { padding: 20 },
  sectionHeader: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  jobTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E5834' },
  jobLocation: { fontSize: 12, color: '#666', marginTop: 2 },
  payTag: { backgroundColor: '#E3B642', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: 'bold', color: '#2E5834', overflow: 'hidden' },
  jobDesc: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 15 },
  applyButton: { backgroundColor: '#2E5834', padding: 10, borderRadius: 6, alignItems: 'center' },
  applyButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
});
