import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, SafeAreaView, FlatList } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from './supabase'; 

export default function App() {
  const [jobs, setJobs] = useState([]);

  // This fetches data from your database when the app loads
  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await supabase.from('jobs').select('*');
      if (data) setJobs(data);
    };
    fetchJobs();
  }, []);

  // A single job card component
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
      <TouchableOpacity style={styles.applyButton}>
        <Text style={styles.applyButtonText}>Apply Now</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView>
        
        {/* HERO SECTION */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Welcome to AgriLink</Text>
          <Text style={styles.heroSubtitle}>Connecting farmers and workers.</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.btnPrimary}>
              <Text style={styles.btnTextPrimary}>Find Work</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary}>
              <Text style={styles.btnTextSecondary}>Hire Staff</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* HOW IT WORKS */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>How It Works</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.icon}>👨‍🌾</Text>
              <Text style={styles.gridLabel}>For Farmers</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.icon}>🚜</Text>
              <Text style={styles.gridLabel}>For Workers</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.icon}>🤝</Text>
              <Text style={styles.gridLabel}>Community</Text>
            </View>
          </View>
        </View>

        {/* JOB LIST */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>Recent Jobs</Text>
          {/* If no jobs found, show a placeholder */}
          {jobs.length === 0 && (
             <Text style={{color: '#999', fontStyle: 'italic'}}>Loading jobs or no jobs found...</Text>
          )}
          <FlatList
            data={jobs}
            renderItem={renderJob}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false} // We let the main ScrollView handle scrolling
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// STYLES - The "CSS" of Mobile Apps
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  // Hero (Green Header)
  hero: {
    backgroundColor: '#2E5834', // Forest Green
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomRightRadius: 30,
    borderBottomLeftRadius: 30,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#D0E8D4', // Light green text
    marginBottom: 25,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPrimary: {
    backgroundColor: '#E3B642', // Yellow
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnTextPrimary: { color: '#2E5834', fontWeight: 'bold' },
  btnTextSecondary: { color: 'white', fontWeight: 'bold' },

  // Sections
  section: { padding: 20 },
  sectionHeader: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  
  // Grid (How it works)
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  gridItem: { backgroundColor: 'white', width: '30%', padding: 15, borderRadius: 10, alignItems: 'center', elevation: 2 },
  icon: { fontSize: 24, marginBottom: 5 },
  gridLabel: { fontSize: 12, fontWeight: '600', color: '#555' },

  // Job Cards
  listSection: { padding: 20 },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3, // Android shadow
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  jobTitle: { fontSize: 16, fontWeight: 'bold', color: '#2E5834' },
  jobLocation: { fontSize: 12, color: '#666', marginTop: 2 },
  payTag: { backgroundColor: '#E3B642', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: 'bold', color: '#2E5834', overflow: 'hidden', height: 25 },
  jobDesc: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 15 },
  applyButton: { backgroundColor: '#2E5834', padding: 10, borderRadius: 6, alignItems: 'center' },
  applyButtonText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
});
