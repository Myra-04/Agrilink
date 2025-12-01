import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Alert, 
  ImageBackground, SafeAreaView, ActivityIndicator, LayoutAnimation, Platform, UIManager, Modal, KeyboardAvoidingView, FlatList 
} from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker'; 
import { supabase } from './supabase'; 

// --- ENABLE SMOOTH ANIMATIONS ---
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function App() {
  // STATE
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [view, setView] = useState('welcome'); 
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(true);
  
  // Profile
  const [profile, setProfile] = useState({ full_name: '', phone: '', bio: '', experience_years: '', experience_details: '', resume_url: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Data
  const [jobs, setJobs] = useState([]); 
  const [myApplications, setMyApplications] = useState([]); 
  const [newJob, setNewJob] = useState({ title: '', location: '', pay: '', desc: '' });
  
  // Community
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  
  // Modals
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Resume
  const [uploadingResume, setUploadingResume] = useState(false);

  // LOAD USER ON START
  useEffect(() => { checkUser(); }, []);

  // --- ANIMATED TRANSITIONS ---
  const changeView = (newView) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setView(newView);
  };
  const changeTab = (newTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(newTab);
    if (newTab === 'community') fetchPosts();
    if (newTab === 'home' && session) fetchData(userRole, session.user.id);
  };

  // --- AUTH ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null); setUserRole(null); setJobs([]); setMyApplications([]);
    setProfile({ full_name: '', phone: '', bio: '', experience_years: '' });
    changeView('welcome');
  };

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (data) {
          setUserRole(data.role);
          setProfile(data);
          changeView('main');
          fetchData(data.role, session.user.id);
        } else {
           setLoading(false); changeView('welcome');
        }
      } else {
        setLoading(false); changeView('welcome');
      }
    } catch (e) { setLoading(false); }
  };

  const fetchData = async (role, userId) => {
    try {
      let jobQuery = supabase.from('jobs').select('*');
      if (role === 'farmer') {
        jobQuery = jobQuery.eq('farmer_id', userId); 
      }
      const { data: jobData } = await jobQuery;
      setJobs(jobData || []);

      if (role === 'worker') {
        const { data: appData } = await supabase.from('applications').select('*, jobs(*)').eq('worker_id', userId);
        setMyApplications(appData || []);
      }
    } catch (e) { console.log(e); } 
    finally { setLoading(false); }
  };

  const handleAuth = async () => {
    if(!email || !password) return Alert.alert("Error", "Please fill in all fields");
    setLoading(true);
    
    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { Alert.alert("Login Failed", error.message); setLoading(false); } 
      else { 
        setSession(data.session); 
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
        if(profileData) {
          setUserRole(profileData.role); setProfile(profileData); changeView('main'); fetchData(profileData.role, data.session.user.id);
        } else {
            await supabase.from('profiles').insert({ id: data.session.user.id, role: userRole || 'worker', full_name: 'New User' });
            setLoading(false); changeView('welcome');
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { Alert.alert("Error", error.message); setLoading(false); }
      else {
        await supabase.from('profiles').insert({ id: data.user.id, role: userRole, full_name: 'New User' });
        Alert.alert("Success", "Account created! Please Log in."); setIsLoginMode(true); setLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return Alert.alert("Wait!", "Please type your email in the box first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Check Email", "Password reset link sent to " + email);
  };

  // --- ACTIONS: JOBS ---
  const postJob = async () => {
    if (!newJob.title || !newJob.pay) return Alert.alert("Missing Info");
    const { error } = await supabase.from('jobs').insert({ 
        title: newJob.title,
        location: newJob.location,
        pay_rate: newJob.pay,
        description: newJob.desc, 
        farmer_id: session.user.id 
    });

    if (error) Alert.alert("Post Job Failed", error.message);
    else {
        setNewJob({ title: '', location: '', pay: '', desc: '' });
        Alert.alert("Success", "Job Posted!");
        fetchData('farmer', session.user.id);
    }
  };

  const applyForJob = async (jobId) => {
    // 1. Frontend Check (Instant feedback)
    if (myApplications.find(a => a.job_id === jobId)) {
        return Alert.alert("Notice", "You have already applied for this job.");
    }
    
    // 2. Database Attempt
    const { error } = await supabase.from('applications').insert({ 
      job_id: jobId, 
      worker_id: session.user.id 
    });
    
    if (error) {
      // 3. Backend Check (If Frontend Check failed/lagged)
      if (error.code === '23505') { // Code for "Unique Violation"
          Alert.alert("Notice", "You have already applied for this job.");
      } else {
          Alert.alert("Apply Failed", error.message);
      }
    } else {
      Alert.alert("🎉 Success", "Application Sent!"); 
      setJobModalVisible(false); 
      fetchData('worker', session.user.id);
    }
  };

  // --- COMMUNITY ---
  const fetchPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, post_likes(user_id)')
        .order('created_at', { ascending: false });
        
    if (data) {
        const processed = data.map(post => ({
            ...post,
            isLikedByMe: post.post_likes ? post.post_likes.some(like => like.user_id === session.user.id) : false
        }));
        setPosts(processed);
    }
  };

  const createPost = async () => {
    if (!newPostContent) return Alert.alert("Empty", "Please write something!");
    const safeName = profile.full_name || 'Anonymous';
    const safeRole = userRole || 'user';

    const { error } = await supabase.from('posts').insert({
      content: newPostContent, 
      author_id: session.user.id, 
      author_name: safeName, 
      author_role: safeRole
    });

    if (!error) { 
      setNewPostContent(''); 
      fetchPosts(); 
      Alert.alert("Success", "Posted!");
    } else {
      Alert.alert("Post Failed", error.message);
    }
  };

  const likePost = async (post) => {
    const isCurrentlyLiked = post.isLikedByMe;
    const newLikeCount = isCurrentlyLiked ? (post.likes - 1) : (post.likes + 1);
    
    const updatedPosts = posts.map(p => p.id === post.id ? { ...p, likes: newLikeCount, isLikedByMe: !isCurrentlyLiked } : p);
    setPosts(updatedPosts);

    if (isCurrentlyLiked) {
        await supabase.from('post_likes').delete().match({ user_id: session.user.id, post_id: post.id });
        await supabase.from('posts').update({ likes: newLikeCount }).eq('id', post.id);
    } else {
        await supabase.from('post_likes').insert({ user_id: session.user.id, post_id: post.id });
        await supabase.from('posts').update({ likes: newLikeCount }).eq('id', post.id);
    }
  };

  const openComments = async (post) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    const { data } = await supabase.from('comments').select('*').eq('post_id', post.id).order('created_at');
    setComments(data || []);
  };

  const postComment = async () => {
    if (!newComment) return;
    const { error } = await supabase.from('comments').insert({
      post_id: selectedPost.id, user_id: session.user.id, user_name: profile.full_name, content: newComment
    });
    if (!error) {
      setNewComment('');
      const { data } = await supabase.from('comments').select('*').eq('post_id', selectedPost.id).order('created_at');
      setComments(data || []);
    }
  };

  // --- RESUME ---
  const pickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!result.canceled) { uploadResumeToSupabase(result.assets[0]); }
    } catch (err) { console.log(err); }
  };

  const uploadResumeToSupabase = async (file) => {
    setUploadingResume(true);
    const fileName = `${session.user.id}_${Date.now()}.pdf`;
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: 'application/pdf' });
    const { error } = await supabase.storage.from('resumes').upload(fileName, formData, { contentType: 'application/pdf' });
    if (error) Alert.alert("Upload Failed", error.message);
    else {
      const { data } = supabase.storage.from('resumes').getPublicUrl(fileName);
      const newUrl = data.publicUrl;
      await supabase.from('profiles').update({ resume_url: newUrl }).eq('id', session.user.id);
      setProfile({ ...profile, resume_url: newUrl });
      Alert.alert("Success", "Resume Uploaded!");
    }
    setUploadingResume(false);
  };

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name, phone: profile.phone, bio: profile.bio,
      experience_years: profile.experience_years, experience_details: profile.experience_details
    }).eq('id', session.user.id);
    setLoading(false);
    if (error) Alert.alert("Error", error.message);
    else { Alert.alert("Success", "Profile Updated!"); setIsEditingProfile(false); }
  };

  const getAppStatus = (jobId) => {
    const app = myApplications.find(a => a.job_id === jobId);
    return app ? app.status : null; 
  };

  // --- RENDERERS ---

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2E5834" /></View>;

  // 1. WELCOME
  if (view === 'welcome') return (
    <ImageBackground source={{uri: 'https://images.unsplash.com/photo-1625246333195-98d804e9b371?q=80'}} style={styles.bgImage}>
      <View style={styles.overlay}>
        <Text style={styles.titleBig}>AgriLink 🌾</Text>
        <Text style={{color:'#eee', marginBottom:30}}>Connect. Grow. Harvest.</Text>
        <View style={styles.glassCard}>
          <Text style={styles.labelWhite}>Choose your role:</Text>
          <TouchableOpacity style={styles.roleBtn} onPress={() => { setUserRole('farmer'); changeView('auth'); }}>
            <Text style={{fontSize:24}}>👨‍🌾</Text><Text style={styles.roleText}>Farmer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleBtn} onPress={() => { setUserRole('worker'); changeView('auth'); }}>
            <Text style={{fontSize:24}}>👷</Text><Text style={styles.roleText}>Worker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );

  // 2. AUTH
  if (view === 'auth') return (
    <SafeAreaView style={styles.container}>
      <View style={styles.padding}>
        <TouchableOpacity onPress={() => changeView('welcome')}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.header}>{isLoginMode ? 'Welcome Back 👋' : 'Join Us 🚀'}</Text>
        <Text style={styles.subHeader}>{userRole === 'farmer' ? 'Farmer Portal' : 'Worker Portal'}</Text>
        <TextInput placeholder="📧 Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
        <TextInput placeholder="🔒 Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        <TouchableOpacity style={styles.btnMain} onPress={handleAuth}><Text style={styles.btnText}>{isLoginMode ? 'Log In' : 'Sign Up'}</Text></TouchableOpacity>
        {isLoginMode && <TouchableOpacity onPress={handleForgotPassword} style={{alignSelf:'flex-end', marginTop:10}}><Text style={{color:'#666'}}>Forgot Password?</Text></TouchableOpacity>}
        <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.spring); setIsLoginMode(!isLoginMode); }} style={{marginTop:30, alignSelf:'center'}}>
            <Text style={{color:'#2E5834', fontWeight:'bold'}}>{isLoginMode ? 'New here? Create Account' : 'Back to Login'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // 3. MAIN APP
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.appLogo}>AgriLink 🚜</Text>
        <TouchableOpacity onPress={handleLogout}><Ionicons name="log-out-outline" size={24} color="white" /></TouchableOpacity>
      </View>

      <View style={{flex:1}}>
        {/* TAB: JOBS */}
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.padding}>
            <TouchableOpacity style={styles.communityBanner} onPress={() => { changeTab('community'); }}>
               <View><Text style={{fontWeight:'bold', color:'#fff'}}>📢 Community Hub</Text><Text style={{color:'#E8F5E9', fontSize:12}}>See what's happening</Text></View>
               <Ionicons name="arrow-forward-circle" size={30} color="white" />
            </TouchableOpacity>

            {userRole === 'farmer' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardHeader}>✍️ Post a Job</Text>
                  <TextInput placeholder="Job Title" value={newJob.title} onChangeText={t=>setNewJob({...newJob, title:t})} style={styles.inputSmall} />
                  <View style={{flexDirection:'row', gap:10}}>
                     <TextInput placeholder="📍 Location" value={newJob.location} onChangeText={t=>setNewJob({...newJob, location:t})} style={[styles.inputSmall, {flex:1}]} />
                     <TextInput placeholder="💰 Pay (RM)" value={newJob.pay} onChangeText={t=>setNewJob({...newJob, pay:t})} style={[styles.inputSmall, {flex:1}]} />
                  </View>
                  <TextInput placeholder="📝 Description" value={newJob.desc} onChangeText={t=>setNewJob({...newJob, desc:t})} style={styles.inputSmall} />
                  <TouchableOpacity style={styles.btnMain} onPress={postJob}><Text style={styles.btnText}>Post</Text></TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>My Listings 📋</Text>
                {jobs.map(job => (
                  <View key={job.id} style={styles.jobCard}>
                    <View style={{flex:1}}>
                      <Text style={styles.jobTitle}>{job.title}</Text>
                      <Text style={styles.jobSub}>📍 {job.location}  •  💰 {job.pay_rate}</Text>
                    </View>
                    <View style={[styles.statusBadge, {backgroundColor:'#E8F5E9'}]}>
                        <Text style={{fontSize:10, fontWeight:'bold', color:'green'}}>ACTIVE</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {userRole === 'worker' && (
              <>
                <Text style={styles.sectionTitle}>My Applications 📂</Text>
                {myApplications.length === 0 ? (
                  <Text style={{color:'#999', fontStyle:'italic', marginBottom:20}}>No applications yet.</Text>
                ) : (
                  myApplications.map(app => (
                    <View key={app.id} style={[styles.jobCard, {borderLeftColor: app.status==='accepted'?'green':'orange'}]}>
                      <View>
                        <Text style={styles.jobTitle}>{app.jobs ? app.jobs.title : 'Job Removed'}</Text>
                        <Text style={{color:'#666', fontSize:12}}>Status: <Text style={{fontWeight:'bold', color: app.status==='accepted'?'green':'orange'}}>{app.status.toUpperCase()}</Text></Text>
                      </View>
                    </View>
                  ))
                )}

                <Text style={[styles.sectionTitle, {marginTop:10}]}>Available Jobs 💼</Text>
                {jobs.map(job => {
                  const status = getAppStatus(job.id);
                  return (
                    <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => { setSelectedJob(job); setJobModalVisible(true); }}>
                      <View style={{flex:1}}>
                        <Text style={styles.jobTitle}>{job.title}</Text>
                        <Text style={styles.jobSub}>📍 {job.location}  •  💰 {job.pay_rate}</Text>
                      </View>
                      <View style={[styles.statusBadge, status ? {backgroundColor:'#E8F5E9'} : {backgroundColor:'#FFF3E0'}]}>
                          <Text style={{fontSize:10, fontWeight:'bold', color: status ? 'green' : 'orange'}}>
                            {status ? 'APPLIED' : 'VIEW'}
                          </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}

        {/* TAB: COMMUNITY */}
        {activeTab === 'community' && (
          <ScrollView contentContainerStyle={styles.padding}>
             <Text style={styles.sectionTitle}>Community Feed 🗣️</Text>
             <View style={styles.card}>
               <TextInput placeholder="What's happening?" value={newPostContent} onChangeText={setNewPostContent} multiline style={{minHeight:60}} />
               <TouchableOpacity style={[styles.smallBtn, {alignSelf:'flex-end', marginTop:10, backgroundColor:'#2E5834'}]} onPress={createPost}>
                 <Text style={{color:'white'}}>Post</Text>
               </TouchableOpacity>
             </View>
             
             {posts.map(post => (
               <View key={post.id} style={styles.postCard}>
                 <Text style={{fontWeight:'bold'}}>{post.author_name} <Text style={{fontWeight:'normal', fontSize:12}}>({post.author_role})</Text></Text>
                 <Text style={{color:'#444', marginTop:5, marginBottom:10}}>{post.content}</Text>
                 
                 <View style={{flexDirection:'row', borderTopWidth:1, borderColor:'#eee', paddingTop:10, gap:20}}>
                    {/* TOGGLE LIKE BUTTON */}
                    <TouchableOpacity onPress={() => likePost(post)} style={{flexDirection:'row', alignItems:'center'}}>
                      <Ionicons name={post.isLikedByMe ? "heart" : "heart-outline"} size={20} color={post.isLikedByMe ? "red" : "#666"} />
                      <Text style={{marginLeft:5, color:'#666'}}>{post.likes || 0}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => openComments(post)} style={{flexDirection:'row', alignItems:'center'}}>
                      <Ionicons name="chatbubble-outline" size={20} color="#666" />
                      <Text style={{marginLeft:5, color:'#666'}}>Reply</Text>
                    </TouchableOpacity>
                 </View>
               </View>
             ))}
          </ScrollView>
        )}

        {/* TAB: PROFILE */}
        {activeTab === 'profile' && (
           <ScrollView contentContainerStyle={styles.padding}>
             <View style={styles.profileBox}>
                <View style={styles.avatarCircle}><Text style={{fontSize:40}}>{userRole === 'farmer' ? '👨‍🌾' : '👷'}</Text></View>
                
                <TouchableOpacity style={{position:'absolute', right:20, top:20}} onPress={() => setIsEditingProfile(!isEditingProfile)}>
                  <Ionicons name={isEditingProfile ? "close-circle" : "create-outline"} size={28} color="#2E5834" />
                </TouchableOpacity>

                {isEditingProfile ? (
                  <View style={{width:'100%'}}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput value={profile.full_name} onChangeText={t=>setProfile({...profile, full_name:t})} style={styles.input} />
                    <Text style={styles.label}>Phone</Text>
                    <TextInput value={profile.phone} onChangeText={t=>setProfile({...profile, phone:t})} style={styles.input} />
                    <Text style={styles.label}>Bio</Text>
                    <TextInput value={profile.bio} onChangeText={t=>setProfile({...profile, bio:t})} multiline style={[styles.input, {height:80}]} />
                    
                    {userRole === 'worker' && (
                      <View style={{marginTop:10, paddingTop:10, borderTopWidth:1, borderColor:'#eee'}}>
                        <Text style={[styles.label, {color:'#E3B642'}]}>Experience</Text>
                        <TextInput placeholder="Years" value={profile.experience_years} onChangeText={t=>setProfile({...profile, experience_years:t})} style={styles.input} />
                      </View>
                    )}
                    <TouchableOpacity style={styles.btnMain} onPress={saveProfile}>
                      {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>Save Changes</Text>}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{alignItems:'center', width:'100%'}}>
                    <Text style={styles.sectionTitle}>{profile.full_name || 'User'}</Text>
                    <Text style={{color:'#666', marginBottom:5}}>{profile.phone || 'No phone added'}</Text>
                    <Text style={{textAlign:'center', fontStyle:'italic', color:'#555', marginBottom:20}}>"{profile.bio || 'No bio yet.'}"</Text>
                    
                    {userRole === 'worker' && (
                      <>
                        <View style={{backgroundColor:'#F9F9F9', padding:15, borderRadius:10, width:'100%', alignItems:'center', marginBottom:10}}>
                           <Text style={{fontWeight:'bold'}}>Experience: {profile.experience_years || 0} Years</Text>
                        </View>
                        <TouchableOpacity style={[styles.btnSec, {width:'100%', flexDirection:'row', justifyContent:'center'}]} onPress={pickResume}>
                           <Ionicons name="document-text" size={20} color="#2E5834" />
                           <Text style={{marginLeft:10, fontWeight:'bold', color:'#2E5834'}}>
                             {uploadingResume ? "Uploading..." : profile.resume_url ? "Update Resume PDF" : "Upload Resume PDF"}
                           </Text>
                        </TouchableOpacity>
                        {profile.resume_url && <Text style={{color:'green', marginTop:5, fontSize:12}}>✅ Resume Active</Text>}
                      </>
                    )}
                  </View>
                )}
             </View>
           </ScrollView>
        )}
      </View>

      {/* MODALS */}
      <Modal visible={jobModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={{alignSelf:'flex-end'}} onPress={() => setJobModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            {selectedJob && (
              <>
                <Text style={styles.modalTitle}>{selectedJob.title}</Text>
                <Text style={styles.modalSub}>📍 {selectedJob.location}</Text>
                <Text style={styles.modalPay}>💰 {selectedJob.pay_rate}</Text>
                <View style={styles.divider} />
                <ScrollView style={{maxHeight:150}}><Text style={{color:'#444', lineHeight:22}}>{selectedJob.description}</Text></ScrollView>
                {userRole === 'worker' && (
                  <TouchableOpacity 
                    style={[styles.btnMain, {marginTop:20, backgroundColor: getAppStatus(selectedJob.id) ? '#ccc' : '#E3B642'}]}
                    // removed disabled={...} so you can click it!
                    onPress={() => applyForJob(selectedJob.id)}
                  >
                    <Text style={[styles.btnText, {color: getAppStatus(selectedJob.id) ? '#666' : '#2E5834'}]}>
                      {getAppStatus(selectedJob.id) ? 'ALREADY APPLIED' : 'APPLY NOW'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={commentModalVisible} animationType="slide">
        <SafeAreaView style={{flex:1}}>
          <View style={[styles.topBar, {flexDirection:'row', alignItems:'center'}]}>
             <TouchableOpacity onPress={() => setCommentModalVisible(false)}><Text style={{color:'white'}}>Close</Text></TouchableOpacity>
             <Text style={[styles.appLogo, {marginLeft:20, fontSize:18}]}>Comments</Text>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
            <FlatList data={comments} contentContainerStyle={{padding:20}} renderItem={({item}) => (
               <View style={{backgroundColor:'#eee', padding:10, borderRadius:10, marginBottom:10}}>
                 <Text style={{fontWeight:'bold', fontSize:12}}>{item.user_name}</Text>
                 <Text>{item.content}</Text>
               </View>
            )}/>
            <View style={{padding:15, borderTopWidth:1, borderColor:'#ddd', flexDirection:'row'}}>
              <TextInput placeholder="Write a comment..." value={newComment} onChangeText={setNewComment} style={{flex:1, padding:10, borderWidth:1, borderColor:'#ddd', borderRadius:20}} />
              <TouchableOpacity onPress={postComment} style={{justifyContent:'center', marginLeft:10}}><Ionicons name="send" size={24} color="#2E5834"/></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => changeTab('home')}><Ionicons name="briefcase" size={24} color={activeTab==='home'?'#E3B642':'#fff'} /><Text style={styles.navText}>Jobs</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => changeTab('community')}><Ionicons name="people" size={24} color={activeTab==='community'?'#E3B642':'#fff'} /><Text style={styles.navText}>Community</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => changeTab('profile')}><Ionicons name="person" size={24} color={activeTab==='profile'?'#E3B642':'#fff'} /><Text style={styles.navText}>Profile</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  padding: { padding: 20, paddingBottom: 100 },
  bgImage: { flex: 1 },
  overlay: { backgroundColor: 'rgba(46, 88, 52, 0.85)', flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  titleBig: { fontSize: 42, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.9)', width: '100%', padding: 25, borderRadius: 20 },
  roleBtn: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, alignItems:'center', borderWidth:1, borderColor:'#ddd' },
  roleText: { fontSize: 18, marginLeft: 15, fontWeight:'600', color:'#2E5834' },
  labelWhite: { color: '#333', fontSize:16, fontWeight:'bold', marginBottom:15, textAlign:'center' },
  header: { fontSize: 28, fontWeight: 'bold', color: '#2E5834', marginBottom: 5 },
  subHeader: { color: '#666', marginBottom: 30, fontSize:16 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 15, fontSize:16 },
  btnMain: { backgroundColor: '#2E5834', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#2E5834', shadowOpacity: 0.3, shadowRadius: 5, elevation:4 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSec: { backgroundColor: '#fff', borderWidth:1, borderColor:'#2E5834', padding: 12, borderRadius: 12, alignItems: 'center' },
  topBar: { backgroundColor: '#2E5834', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems:'center' },
  appLogo: { color: '#fff', fontSize: 22, fontWeight: 'bold', letterSpacing:1 },
  communityBanner: { backgroundColor:'#4CAF50', padding:15, borderRadius:15, marginBottom:20, flexDirection:'row', justifyContent:'space-between', alignItems:'center', shadowColor:'#000', shadowOpacity:0.1, shadowRadius:4, elevation:3 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:10, elevation:2 },
  cardHeader: { fontSize:18, fontWeight:'bold', color:'#333', marginBottom:15 },
  inputSmall: { backgroundColor: '#F9F9F9', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15, marginTop:10 },
  jobCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, flexDirection:'row', justifyContent:'space-between', alignItems:'center', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:2, borderLeftWidth:4, borderLeftColor:'#E3B642' },
  jobTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  jobSub: { color: '#666', fontSize:13 },
  statusBadge: { padding:5, borderRadius:5 },
  postCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, elevation: 1 },
  smallBtn: { paddingVertical:8, paddingHorizontal:15, borderRadius:20 },
  profileBox: { alignItems:'center', backgroundColor:'#fff', padding:30, borderRadius:20 },
  avatarCircle: { width:100, height:100, backgroundColor:'#F0F5F1', borderRadius:50, justifyContent:'center', alignItems:'center', marginBottom:20 },
  label: { alignSelf:'flex-start', marginLeft:5, marginBottom:5, fontWeight:'600', color:'#555', marginTop:10 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#2E5834', flexDirection: 'row', paddingVertical: 12, paddingHorizontal:20, justifyContent: 'space-around', borderTopLeftRadius:20, borderTopRightRadius:20 },
  navItem: { alignItems: 'center' },
  navText: { color: '#fff', fontSize: 11, marginTop: 4, fontWeight:'600' },
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', padding:20 },
  modalContent: { backgroundColor:'#fff', borderRadius:20, padding:25 },
  modalTitle: { fontSize:22, fontWeight:'bold', color:'#2E5834', marginBottom:5 },
  modalSub: { fontSize:16, color:'#666', marginBottom:5 },
  modalPay: { fontSize:18, fontWeight:'bold', color:'#E3B642', marginBottom:15 },
  divider: { height:1, backgroundColor:'#eee', marginVertical:15 }
});