package com.nativephp.mobile.ui

import android.util.Log
import androidx.compose.material3.DrawerState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.State
import kotlinx.coroutines.CoroutineScope

/**
 * Singleton to manage NativeUI state from Laravel responses
 */
object NativeUIState {
    private const val TAG = "NativeUIState"

    private val _components = mutableStateOf<List<NativeComponent>>(emptyList())
    val components: State<List<NativeComponent>> = _components

    private val _bottomNavData = mutableStateOf<BottomNavData?>(null)
    val bottomNavData: State<BottomNavData?> = _bottomNavData

    private val _sideNavData = mutableStateOf<SideNavData?>(null)
    val sideNavData: State<SideNavData?> = _sideNavData

    private val _fabData = mutableStateOf<FabData?>(null)
    val fabData: State<FabData?> = _fabData

    private val _topBarData = mutableStateOf<TopBarData?>(null)
    val topBarData: State<TopBarData?> = _topBarData

    // [media-player-android-state-patch]
    private val _mediaPlayerData = mutableStateOf<MediaPlayerData?>(null)
    val mediaPlayerData: State<MediaPlayerData?> = _mediaPlayerData

    // Keyboard visibility state - used to hide bottom nav when keyboard is open
    private val _isKeyboardVisible = mutableStateOf(false)
    val isKeyboardVisible: State<Boolean> = _isKeyboardVisible

    // Drawer state for side nav - accessible globally to open/close drawer
    var drawerState: DrawerState? = null
    var drawerScope: CoroutineScope? = null

    /**
     * Update keyboard visibility state
     */
    fun setKeyboardVisible(visible: Boolean) {
        _isKeyboardVisible.value = visible
    }

    fun updateMediaPlayer(data: MediaPlayerData) {
        _mediaPlayerData.value = data
    }

    fun clearMediaPlayer() {
        _mediaPlayerData.value = null
    }

    /**
     * Update UI state from Edge component data (JSON string or parsed object)
     */
    fun updateFromJson(json: Any?) {
        if (json == null) {
            Log.d(TAG, "No Native UI data in response")
            clearAll()
            return
        }

        // Handle both String (for legacy) and raw objects (from bridge)
        val parsedComponents = when (json) {
            is String -> {
                if (json.isBlank()) {
                    clearAll()
                    return
                }
                Log.d(TAG, "Parsing Native UI JSON string")
                NativeUIParser.parse(json)
            }
            else -> {
                // Already parsed - use Gson to convert to our model
                Log.d(TAG, "Parsing Native UI from object")
                NativeUIParser.parseFromObject(json)
            }
        }

        _components.value = parsedComponents

        // Extract bottom nav if present
        val bottomNav = parsedComponents.firstOrNull { it.type == "bottom_nav" }
        if (bottomNav != null) {
            val bottomNavData = NativeUIParser.parseBottomNavData(bottomNav.data)
            _bottomNavData.value = bottomNavData
            Log.d(TAG, "Bottom nav updated with ${bottomNavData?.children?.size ?: 0} items")
        } else {
            _bottomNavData.value = null
            Log.d(TAG, "No bottom nav in response")
        }

        // Extract side nav if present
        val sideNav = parsedComponents.firstOrNull { it.type == "side_nav" }
        if (sideNav != null) {
            Log.d(TAG, "📋 Raw side_nav data: ${sideNav.data}")
            val sideNavData = NativeUIParser.parseSideNavData(sideNav.data)
            _sideNavData.value = sideNavData
            Log.d(TAG, "📋 Parsed side nav with ${sideNavData?.children?.size ?: 0} children")
            sideNavData?.children?.forEachIndexed { index, child ->
                Log.d(TAG, "📋   Child $index: type=${child.type}, data=${child.data}")
            }
        } else {
            _sideNavData.value = null
            Log.d(TAG, "No side nav in response")
        }

        // Extract FAB if present
        val fab = parsedComponents.firstOrNull { it.type == "fab" }
        if (fab != null) {
            val fabData = NativeUIParser.parseFabData(fab.data)
            _fabData.value = fabData
            Log.d(TAG, "FAB updated: ${fabData?.label ?: "icon-only"}")
        } else {
            _fabData.value = null
            Log.d(TAG, "No FAB in response")
        }

        // Extract Top Bar if present
        val topBar = parsedComponents.firstOrNull { it.type == "top_bar" }
        if (topBar != null) {
            val topBarData = NativeUIParser.parseTopBarData(topBar.data)
            _topBarData.value = topBarData
            Log.d(TAG, "Top Bar updated: ${topBarData?.title}")
        } else {
            _topBarData.value = null
            Log.d(TAG, "No Top Bar in response")
        }

        // Extract media player EDGE component if present
        val mediaPlayer = parsedComponents.firstOrNull { it.type.equals("media-player") }
        if (mediaPlayer !== null) {
            val mediaPlayerData = NativeUIParser.parseMediaPlayerData(mediaPlayer.data)
            _mediaPlayerData.value = mediaPlayerData
            Log.d(TAG, "Media player updated: ${mediaPlayerData?.type}")
        }
        // Note: do not clear _mediaPlayerData when absent — it is managed via bridge calls
    }

    /**
     * Optimistically update bottom nav active state before page loads
     * This prevents the visual "flash" when clicking nav items
     */
    fun setBottomNavActiveOptimistic(url: String) {
        val current = _bottomNavData.value ?: return

        // Update active state for all items based on URL
        val updatedChildren = current.children?.map { child ->
            val updatedData = child.data.copy(
                active = child.data.url == url
            )
            child.copy(data = updatedData)
        }

        _bottomNavData.value = current.copy(children = updatedChildren)
        Log.d(TAG, "🎯 Optimistically set active bottom nav item to: $url")
    }

    /**
     * Clear all UI state
     */
    fun clearAll() {
        _components.value = emptyList()
        _bottomNavData.value = null
        _sideNavData.value = null
        _fabData.value = null
        _topBarData.value = null
        // Note: _mediaPlayerData is managed via bridge calls, not cleared here
    }

    /**
     * Check if bottom nav should be visible
     */
    fun hasBottomNav(): Boolean {
        return _bottomNavData.value != null &&
               !_bottomNavData.value?.children.isNullOrEmpty()
    }

    /**
     * Check if side nav should be visible
     */
    fun hasSideNav(): Boolean {
        return _sideNavData.value != null &&
               !_sideNavData.value?.children.isNullOrEmpty()
    }

    /**
     * Check if FAB should be visible
     */
    fun hasFab(): Boolean {
        return _fabData.value != null
    }
}
