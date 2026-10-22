# 待办清单 Demo（Expo + React Native · 安卓）

一个安卓待办应用的预览 Demo：首页把任务分成逾期／今天／未来三组，底部三个平级标签（首页 / 日历 / 设置）可以点也可以左右滑切换，新建和编辑同一页、用自绘的五列滚轮选日期时间。通知有两条线：**每日汇总**在固定时间报一次总数，**每条待办**则在自己的时间响一次（用系统默认通知音，音色可以在系统渠道页里换）；愿意的话也可以把某条改成交给系统日历的「创建日程」页。代码按页面／组件／hook／纯函数分成 `App.tsx` + `src/` 几层，没有导航库、没有图标库、没有 UI 库。

- **截图**：待补，计划放在 `docs/screenshots/`。
- **技术栈**：Expo SDK 57、React Native 0.86、React 19、TypeScript；持久化用 `@react-native-async-storage/async-storage`；原生侧只有两个手写的 Kotlin 模块（发日历意图、按系统音色建通知渠道）。

## 快速开始

```bash
npm install
npm start -- --lan    # 手机和电脑连同一个 Wi-Fi，用 Expo Go 扫码，或在 Expo Go 里输入终端给出的 exp:// 地址
```

`--lan` 不能省：默认模式只提供 `localhost` 地址，手机连不到这台电脑。

想直接用原生壳跑（而不是 Expo Go）用 `npm run android`，但它是 `expo run:android`，**不会带上 `-I ../gradle-mirror.init.gradle`**，国内网络很可能卡在依赖解析上；要构建 APK 请用下面「构建 APK」一节的手写命令。

用 USB 线连手机时，可以先执行 `adb reverse tcp:8081 tcp:8081`，再在 Expo Go 中输入 `exp://localhost:8081`，不依赖同一个 Wi-Fi。

**Expo Go 能预览布局，但跑不通提醒**：`expo-notifications` 在 Expo Go 里任何安排通知的调用都会抛错（它的安卓包缺 `ExpoTopicSubscriptionModule`），发日历意图的 Kotlin 模块也不存在。要验证通知和日历跳转必须构建 APK。

## 构建 APK

依赖：JDK 17、Android SDK 的 `platforms;android-36`、`build-tools;36.0.0`、`ndk;27.1.12297006`（RN 0.86 的 `gradle/libs.versions.toml` 里写死了这几个版本），以及 `npm install` 之后的一份 `node_modules`。

```bash
cd android
./gradlew.bat -PreactNativeArchitectures=arm64-v8a assembleRelease --console=plain
adb install -r app/build/outputs/apk/release/app-release.apk
```

JS 由 Gradle 的 Expo 插件自己打包，不需要提前跑 `expo export`。国内网络请再加 `-I ../gradle-mirror.init.gradle` 走阿里 Maven 镜像（同时 `android/gradle/wrapper/gradle-wrapper.properties` 的 `distributionUrl` 指向腾讯 Gradle 镜像）；细节见附录「打 APK」一节。

四件事得先知道：

1. **不要执行 `npx expo prebuild`。** `android/` 是提交进仓库的，里面有 prebuild 会抹掉的改动：`MainApplication.kt` 手写的 `add(SystemCalendarPackage())`、`AndroidManifest.xml` 的 `<queries>`、镜像补丁、`mipmap-*` 里生成的图标。
2. **`android/app/debug.keystore` 没有提交**（release 也用这套调试签名）。首次构建前自己生成一份，参数要和 `android/app/build.gradle` 的 `signingConfigs.debug` 对上：
   ```bash
   keytool -genkeypair -v -keystore android/app/debug.keystore -alias androiddebugkey \
     -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
     -dname "CN=Android Debug,O=Android,C=Android"
   ```
3. **`android/gradle.properties` 里那 6 行 `systemProp.*` 代理配置是注释状态**，指向作者本机的 `127.0.0.1:10808`。在需要代理的机器上本地取消注释即可，别提交。
4. **项目目录必须是短的真实路径。** 目录联接（junction / 符号链接）不行，Node 会把路径还原成真实路径，`expo-modules-core` 的 CMake 对象路径有 250 字符上限。

## 已知限制

- **每日提醒是「一条固定时间的每日汇总」**，正文数字在打开 App 或改动任务时才重算；一次都没打开过 App 的那天，通知正文停在最后一次计算的值。
- **每条待办的到点通知同理**：排程只在 App 打开且已授予通知权限时重算，改完任务得让 App 至少跑一次这个 effect。已经排好的通知由系统闹钟投递，App 被杀、手机重启照样响。全新安装、还没保存过任何会响的任务之前不会排程。
- **日历提醒是单向的**：开了开关保存后跳到系统日历，App 不知道你在日历里点的是 ✓ 还是 ✗，之后删除/完成/关开关都**取消不了**已存下的日程，要自己去日历删。换来的是不用申请任何日历权限。
- **`USE_EXACT_ALARM` 是安装即授予的特殊权限**，不弹框，用户只能在系统设置的「闹钟和提醒」里看到/关掉；没有它，`expo-notifications` 会静默改用非精确闹钟，到点通知晚十几分钟。
- **DAILY 触发器是非精确闹钟**，小米等机型上可能晚几分钟到几十分钟。
- 小米等机型要在系统设置里允许该应用自启动并取消省电限制，否则到点的提醒可能被系统拦截。
- **到点通知的音色应用自己改不了**：安卓只认渠道创建那一刻的音色，而澎湃不播应用自带的音频文件。要换声音，去设置页「到点提醒铃声」跳进来的系统渠道页里挑（详见附录「声音」一节）。
- 安卓 15（`edgeToEdgeEnabled=true`）起内容画到状态栏和手势横条底下：顶部留白用 `StatusBar.currentHeight` 算，底部避让是固定值，没装 `react-native-safe-area-context`。

## 目录结构

```
App.tsx                     状态、存档读写、任务增删改、通知 hook 装配，末尾五行页面开关（页面用 page 状态切换，不是导航栈）
src/types.ts                Todo / Reminder / Wheel / Page
src/styles.ts               一张 StyleSheet + screenStyle()（顶部避让状态栏）
src/lib/constants.ts        AsyncStorage 的 key、行高、默认提醒、标签栏顺序
src/lib/dates.ts            日期换算、滚轮下限（minWheel / editFloor / clampWheel）
src/lib/todos.ts            示例任务、逾期文案、这条任务会不会响（isRingable）
src/lib/notifications.ts    两条渠道 id、已废弃渠道清单、原生建渠道、跳系统设置
src/lib/calendar.ts         调原生模块发日历意图
src/hooks/useNotifyPermission.ts   通知权限：读一次 + 要一次
src/hooks/useTaskAlarms.ts         整批重排每条待办的到点通知
src/hooks/useDailyReminder.ts      每日汇总的排程与「改了立刻生效」
src/components/{Header,TabBar,Action,TodoRow,WheelColumn,TabShell}.tsx
src/screens/{Home,Calendar,Reminder,Compose,Settings}Screen.tsx
app.json                    Expo 配置；android.icon 指向 assets/app-icon.png
assets/app-icon.png         图标唯一源文件
make-icons.ps1              缩放生成 mipmap-*/ic_launcher(.round).png
gradle-mirror.init.gradle   可选：构建时优先走阿里镜像
android/                    已提交的原生工程（含两个 Kotlin 模块，勿 prebuild）
android/app/src/main/java/com/demo/androidtodo/SystemCalendarModule.kt   发日历意图
android/app/src/main/java/com/demo/androidtodo/NotificationTuningModule.kt   原生建渠道 + 跳渠道设置页
.expo/  node_modules/  .npm-cache/  build/  *.apk   已在 .gitignore 里
```

> `App.tsx` 必须留在仓库根目录：`package.json` 的 main 是 `node_modules/expo/AppEntry.js`，它写死了 `import App from '../../App'`。`src/` 里的路径都是相对它引的，所以拆目录不需要动任何构建配置。

---

## 附录：行为规格与设计取舍

这份附录记录的是**行为规格和踩过的坑**，改代码前先读它。下面出现的日期是改动发生的日期。

## 页面职责

- **首页**（底部标签栏第一个）分三组展示：**逾期**（日期已过且未完成，按日期先后排列，右侧是「隐藏」而不是删除）、**今天**（含已完成，可勾选、删除）、**未来**（日期在之后且未完成，按日期＋时间排列）。顶部只剩「待办清单」大标题和副标题「N 件已逾期 · 今天 M 件待完成」，没有逾期时只显示后半句（原先标题上方的「我的一天」小字和右上角齿轮已于 2026-10-22 移除）。已隐藏的任务不出现在首页，所以首页不会越用越挤。
  - 一行的三个区域各自独立：**左边的方框**改完成状态、**中间正文**进编辑、**右边按钮**是删除／隐藏。点中间那一片（含时间小字）会带着这条任务进编辑页。
  - **逾期分组是只读的**：方框显示 ✗ 但点不动，正文点了也不进编辑——逾期本身就是需要看到的信息，能一键改掉就等于把它抹掉了。要处理它只有「隐藏」，或者改完之后由日期条件自己变化。
- **新建待办 / 编辑待办**是同一个页面，标题按入口变。首页右下角「+」是新建；点「今天」或「未来」分组里某一行的正文，带着那条任务进编辑。顶部是多行正文输入框（最小高度 162dp，写满了自己往下长），下面是自绘的五列滚轮（年 / 月 / 日 / 时 / 分，纯 JS，Expo Go 可用）。滚轮**平时只占一行**（2026-10-22 改的，原先固定显示 3 行）：手指按住某一列，那一列才向上、向下各浮出一行，选中项居中在淡紫色高亮带里；浮出来的两行是**盖在别的内容之上**，不挤开版面，所以展开收起都不会让输入框、日历提醒开关或保存按钮动一下。松手落定后自动收回成一行。某列可选项变多变少只改滚动范围，不影响版面。
  - **「保存」钉在页面底部**：它在 `ScrollView` 外面，不随内容滚动。滚轮下面是一行开关，**默认关闭**；开着的时候保存会跳到系统日历的创建日程页，关着的时候由本应用自己在到点时响（见「每条待办的到点通知」）。这一行原先叫「日历提醒」，2026-10-22 因为默认行为变了改名 **「改用系统日历提醒」**，文案也重写成「默认由本应用响一声」的说法。
  - **键盘不再挡住保存按钮**（2026-10-22）：整个滚动区＋保存按钮包在 `KeyboardAvoidingView behavior="padding"` 里，键盘弹起时给这一层加底部内边距，保存按钮和「日历提醒」那一行一起顶到键盘上方。不能再靠清单里的 `windowSoftInputMode="adjustResize"`：`android/gradle.properties` 开了 `edgeToEdgeEnabled=true`，安卓在这种模式下不自己缩窗口，键盘变成一个要应用自己消费的窗口 inset，那句 `adjustResize` 是空话。配套两条：**进入这一页不自动弹键盘**（去掉了输入框的 `autoFocus`，点一下才弹），以及**手指按住滚轮任何一列，键盘立刻收起**（`Keyboard.dismiss()` 挂在 `onPanResponderGrant`）——选时间不需要键盘。代价是收键盘那一瞬间整页往下回弹一次，此时滚轮的空位会跟着挪，但数字位置由 JS 持有偏移、跟着底板一起走，所以拖动过程不会错位。
  - 编辑只改**正文、日期、时间、日历提醒开关**四项，`done` 和 `hidden` 原样保留，任务的 id 不变（所以不会变成一条新记录插到列表最前面）。改完日期它可能就换组、或者从逾期变成正常，由分组规则自己决定。
  - 滚轮**不用 `ScrollView`**：每列在版面里只排一行高的空位，数字列用 `Animated.Value` 的 `translateY` 定位，偏移量 `-(该值在本列中的序号) × ROW` 完全由 JS 计算，`PanResponder` 负责拖动与抬手吸附。当初的原因是：为了让过去的时间滚不到，某列的可选项会因上层改动而**在头部变长**（年份拨到明年，月列从 3 项变 12 项），而安卓的 `ScrollView` 会按**旧的**内容高度裁剪 `scrollTo` 请求的位置，导致其他列整行错位、拨回来又复原。2026-10-22 改成"显示过去 + 弹回"之后，头部变长只剩「日」列随月份天数变化，但**这套 JS 持有偏移的实现不换回去**——弹回动画本来就得由 JS 驱动，而且显示值与状态值恒等这件事正是它给的。
  - 「展开不挤版面」靠的是绝对定位：那一行高的空位 `overflow: visible`，里面盖一块同样宽的**不透明底板**（`wheelPeek`，底色和页面背景一致，所以能遮住底下的输入框和开关文字），它的 `top` 与 `height` 由同一个 `Animated.Value`（`open`）插值：`top` 从 0 到 `-ROW`、`height` 从 `ROW` 到 `3 × ROW`，于是**选中项永远停在原地，上下各长出一行**。底板自己 `overflow: hidden` 负责裁剪，数字列的上内边距同步从 0 长到 `ROW`，保证显示位置和状态值仍然恒等。展开挂在 `onPanResponderGrant`，收回挂在落定动画的完成回调里（正在被别的手指按着就不收）。安卓的绘制顺序用 `elevation` 解决：滚轮整块 `elevation: 8`、底板 `elevation: 10`，否则后画的「日历提醒」那一行会盖在浮出来的数字上。布局类动画只能 `useNativeDriver: false`。
  - **定时提醒页的时分滚轮没改**，仍是三行高：那一页版面宽松，也没有键盘问题。要一起换成折叠式，给那两个 `WheelColumn` 各加一个 `compact` 就行。
- **只能安排未来**：新建时的下限是 `max(今天 09:00, 进入本页那一刻)`，编辑已有任务时下限放宽到今天 00:00。**过去的选项照样显示在滚轮里**（2026-10-22 改了做法：原先是从列表里直接移除，滚不到），但松手那一刻会**平滑回到**原来的数字（同样是 2026-10-22：原先用 spring 弹跳，反馈是「太突兀、没必要」，现在改成和正常吸附一模一样的缓出回位，不弹跳），同时滚轮下方的小字「不可以新建过去的任务哦！」淡入、停 0.5s 后淡出。判定是拿**整组**值算的，所以年/月/日/时/分任何一列只要组合起来早于下限就整列回位；比如 31 号时把月拨到 2 月，先按当月天数收敛到 28 号，再判是否在过去，是就回去。小字常驻一行固定高度，出现消失都不推版面。
  - 年份列仍从**今年**起，不显示过去的年份：能滚到 2019 年建一条待办没有意义，而那正是"移除 vs 弹回"这套规则唯一还保留移除的地方。
  - 手感参数（2026-10-22 按「太快、突兀」反馈整体放慢一档）：抬手后的惯性从 `vy × 0.08` 降到 `vy × 0.04`，落定动画统一 `Animated.timing` **260ms + `Easing.out(Easing.cubic)`**（原先 120ms 直线，越界回位原先是 spring），底板展开 **220ms**、收起 **260ms**（原先 150 / 180）。提示和回位同一次触发，不排队——连续乱滚只会把 0.5s 的计时往后推。这些都只在 `settleWheel` / `peep` 两处，要再快再慢改数字即可。
- 保存后回到首页（新建是加一条，编辑是原地改这一条）；退出这一页只有左上角「‹」和系统返回键两条路（右上角原先的「✕」已于 2026-10-22 移除），走哪条都一样：新建看输入框有没有内容，编辑看正文／日期／时间是否真的和进来时不同——没变直接回首页，变了才弹窗问「放弃这条待办？」或「放弃这次修改？」。
- **日历页**只负责查看与删除，不再提供新增入口（原先日期下方的输入框和「添加」按钮已移除，要加待办统一走首页右下角「+」）。选中日期后列出**那一天所有任务，包括已隐藏的**——日历页不做隐藏，灰底样式也一并去掉了。
  - 方框里的记号是**状态指示**：完成是 ✓，逾期是 ✗。逾期行的方框**不可点击**，点它不会变成 ✓；要改变状态只能等日期条件变化。非逾期行（今天或未来、或已完成）的方框仍可点，用来勾选/取消完成。
  - 每行右侧统一保留「删除」；如果这一条处于隐藏状态，「删除」前面多一个「显示」按钮，点它把任务放回首页。隐藏是永久性的，直到点「显示」或「恢复示例任务」。
  - 「✗ 不可点」这条规则**首页和日历页一致**：逾期行的方框在两页都只是状态指示。之前只写在日历页、首页逾期行仍可点，结果一点就把任务标成完成、整条从首页消失（已完成的历史任务三个分组都不收），看起来像被删掉了。
- 任务的 `date` 是**计划日期**，不是创建日期。一旦保存就固定不动，不会随日期推移。`time`（`HH:mm`）从 2026-10-22 起**就是这条任务自己的响铃时间**（规则见「每条待办的到点通知」），不再只用于显示和排序；它和「每日汇总」那个全局时间是两回事，各响各的。
- 「顺延」按钮已随新规格移除：**逾期任务没有任何改日期的入口**（编辑页对逾期行不开放，日历页也只有查看和删除），只能隐藏、删除，或者等日期条件自己变化。如果哪天需要给逾期一条「搬到今天」的出路，那是一个要重新提的决定。
- 设置页的「恢复示例任务」按**点击那一刻的今天**重算示例日期（前天 / 今天 / 3 天后各一条，均为未完成），只替换任务列表并清除隐藏标记，不影响其他设置。
- 「左边一段文字 + 右边一个开关或箭头」的行有三处：定时提醒页的开关行、新建待办的日历提醒行、设置页的定时提醒行（原先设置页还有第二行「日历」菜单，2026-10-22 随入口一起删了）。文字列必须能收缩，否则文案一变长就把右边的控件顶出屏幕——RN 的 flex 子项默认**不收缩**，2026-10-22 定时提醒页的开关就是这么跑出界面的。三处统一用 `rowText: { flex: 1, marginRight: 12 }`（首页任务行同理，样式名是 `todoBody`，右间距 10 dp），新加这类行记得带上。

## 底部导航与滑动切换

首页 / 日历 / 设置是三个**平级标签**：底部一条白色圆角栏（`TabBar`）从左到右依次是它们，图标是 `View` 画出来的（文档框 / 日历 / 三条横线），选中紫色 `#625BFF`、未选中灰 `#98A2B3`，图标下面带小字标签。打开 App 默认落在首页（`page` 初值 `'home'`）。

- **左右滑动切换**：这三页外面套了一层 `PanResponder`（`tabShell`）。横向位移要超过 20dp **且**明显大于纵向（`|dx| > 2 × |dy|`）才认领手势，所以列表照常上下滚；松手时位移超过 60dp 才切到相邻标签，**到边不循环**（首页往右滑、设置往左滑都没有反应）。**切换是瞬间换页，没有任何位移动画**（2026-10-22：先做过 220ms 的横向推入，反馈是点底栏时也弹来弹去，于是抽掉）。
- **覆盖页没有这套外壳**：新建／编辑待办、定时提醒是推上来的页面，不显示底栏，也不能左右滑。
- 底栏用 `marginHorizontal: -20` 抵消页面的左右内缩，所以是通栏的圆角条；它的 `paddingBottom: 22` 是给手势横条留的固定避让（不装 `react-native-safe-area-context` 拿不到真实 inset，见「顶部状态栏」）。右下角「+」排在**内容区**里、`bottom: 34` 没变，因为内容区本身已经排在底栏上方，两者不重叠。
- 首页顶部的「我的一天」小标题和右上角齿轮入口已移除（2026-10-22）：设置从底栏进，首页标题只剩「待办清单」＋副标题。设置页里原先那行「日历」入口也删了——日历已经是底栏的一个标签，重复入口没有意义，所以设置页现在只剩「定时提醒」一行加下面的「恢复示例任务」。

## 顶部状态栏

安卓 15 起应用强制 edge-to-edge，内容会绘制到状态栏底下，所以每个页面顶部的留白不是固定值：用 `StatusBar.currentHeight`（安卓返回状态栏高度，单位 dp）再加 12dp 作为页面 `paddingTop`。首页的「待办清单」标题、日历页和设置页的标题栏都靠这个值下移，不会压到状态栏和时间上。

这个办法只覆盖**顶部**；底部导航条（手势横条）的高度在不引入 `react-native-safe-area-context` 的情况下拿不到，因此右下角「+」浮钮改用固定的 `bottom: 34` 避让。若日后要精确适配，安装 `react-native-safe-area-context` 换成 `useSafeAreaInsets`。

## 系统返回键

`App.tsx` 用 `BackHandler` 接管了安卓返回键，行为与各页面左上角的 `‹` 按钮一致：

| 当前页面 | 按系统返回键 |
| --- | --- |
| 日历 / 设置 | 回到「首页」（它们是平级标签，返回落到首页而不是"上一页"） |
| 定时提醒 | 回到「设置」（提醒页没有待保存状态，直接返回） |
| 新建 / 编辑待办 | 没有改动则直接回首页，否则弹窗询问是否放弃（见「页面职责」） |
| 首页 | 退出应用 |

页面切换依靠 `page` 状态而不是真正的导航栈，因此返回只会落到固定的上一级，不会还原完整的访问历史。监听器在 `page` 变化时重新注册，`useEffect` 的依赖数组不能省略，否则回调里读到的是过期的页面值。

提醒页不设「未保存」概念：开关和滚轮都是松手即生效，所以返回时不弹窗、也不会有改动丢失，`goBack` 里不需要为它写分支。

## 定时提醒

提醒页是一行开关加两列滚轮（小时 00–23、分钟 00–59，可视区同样是 3 行），**没有保存按钮**：拨开关、滚轮松手都立刻提交给 `applyReminder`，同时写进 AsyncStorage。开关拨到开就按页面上当时显示的时间安排每日推送；拨到关会撤掉已排的通知并只留着时间，这一步不弹窗——开关本身就是反馈，设置页那行也会跟着显示「（未开启）」。滚轮只在松手定位后触发一次，不会边拖边排。

本地定时通知不需要服务端：它由系统闹钟投递，App 被杀死、手机重启后依然会触发（manifest 里有 `POST_NOTIFICATIONS` 和 `RECEIVE_BOOT_COMPLETED`）。但 **Expo Go 用不了**：它的安卓包里没有 `ExpoTopicSubscriptionModule`，而 `expo-notifications` 在入口处就会加载它，所以在 Expo Go 里任何安排通知的调用都会抛错——这时拨开关会弹「这台机器安排不了」，时间落到本地存储、开关自动弹回关闭状态。要真正收到提醒必须装 APK，构建方法见下一节。

APK 里的行为（每天一条汇总，正文是算出来的）：

- 文案 `今天 N 件待完成 · M 件已逾期`，没有逾期时只有前半句。统计口径和首页一致：**排除已隐藏、排除已完成**；M 是目标日之前所有逾期的任务数。
- 目标日 = 下一次要弹的那一天：当前时间还没走过提醒点就是今天，已经走过就是明天。
- 目标日一件都没有（N+M=0）时**静默**：取消已排的通知，但开关仍显示为开，等有任务了自动排回去。如果你就是在这一刻把开关拨到开的，会弹「还没真正安排上」告诉你没排成功（这一刻说不准是权限没给还是没待办可提醒，所以两种原因写在同一条提示里）。
- 重算时机：打开 App、增删改任务、勾选完成、在提醒页拨开关或改时间。因此**一次都没打开过 App 的那一天，正文数字会停在最后一次打开时算的值**——这是「一条固定时间的每日通知」换实现简单付出的代价。
- 全程只有这一条通知：`notificationId` 记在本地，任何改动都是先取消再重排，不会累积多条。
- 点通知就是冷启动到首页，逾期分组本来就排在最上面，没有做额外跳转。
- 权限只在**把开关拨到开**的那一刻申请；被拒绝则时间照存、通知不排，弹提示让你去系统设置里允许后「把开关关一下再打开」。之后 App 自己不会再弹权限框打扰。
- `DAILY` 触发器是**非精确**闹钟，小米等机型上可能晚几分钟到几十分钟。每日汇总晚一点无所谓。每条待办自己的到点通知不走这个触发器，用的是 `DATE` 一次性触发器加 `USE_EXACT_ALARM`，见下一节。

排程集中在 `src/hooks/useDailyReminder.ts`：`applyReminder` 是唯一的排程入口（自动重算的 `useEffect` 和提醒页的即时提交 `commitReminder` 都调它，区别只在要不要申请权限），`reminderBody` 负责文案、`nextReminderDay` 负责算目标日，这两个纯函数在 `src/lib/todos.ts`。

## 每条待办的到点通知

2026-10-22 起，**每条未到点的待办都由本应用在自己的时间响一次**，不依赖系统日历。只有编辑页把「改用系统日历提醒」那一行打开的任务例外——那些交给日历，本应用不再重复响。

- 通知排在独立渠道 `task-alarms-v5`：可出声的最高优先级 + 震动 + 系统默认通知音（音色为什么不由应用带，见下面那节），标题是 `⏰ HH:mm 待办`，正文是任务内容。
- **同一分钟的多条合并成一条**通知：正文取前两条、中间用「、」，还有更多就追加「 等 N 件」。合并的 key 是「日期 时间」整串，所以不同日期的同一个分钟各响各的。
- **整批重排，不做增量**：任务列表任何变化（新增、编辑、勾选完成、删除、隐藏）都会让那个 `useEffect` 把上一批全部取消，再按当前列表重排。取消要认 id，而这个版本的 `expo-notifications` 没有 `requestIdentifier` 可用（`build/` 与 android 源码都 grep 过），所以排出去的 id 数组记在 AsyncStorage 的 `@android-todo-demo/task-alarms` 里，重启后照样清得掉。列表算出来的签名（每组的 key + 正文）没变时由一个 `useRef` 拦住，不重复排程。
- **权限只在第一次保存一条「真的会响」的待办时申请**——未来时间、未完成、日历开关关着，三者都满足才弹框，不是进 App 就要。被拒绝的话保存照样成功，但会弹「通知没开启」说明这条到点不会响；首页副标题在还有这类任务时也一直挂着「（通知没开启，到点不会响）」。
- 排程那条 `useEffect` 以「已拿到通知权限」为前提（启动时只用 `getPermissionsAsync` 读一次，不主动弹框）。所以全新安装后、还没保存过任何会响的任务之前，示例任务里那条 3 天后的待办并不会排上；一旦权限到手，**整个列表一起补排**，不只补刚保存的那一条。
- 排程本身失败（Expo Go、非安卓环境、通知服务起不来）只 `console.warn`，不弹窗刷屏；那条路径上用户能看到的就是副标题那句提示。

### 设置页的「到点提醒铃声」跳到哪一页

这一行走原生 `openChannelSettings('task-alarms-v5')`，intent 是 `Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS` + 包名 + 渠道 id。在澎湃上它直接落到「任务到点提醒」那一页（允许通知 / 悬浮通知 / 声音 / 振动 / 在锁定屏幕上），**声音那一行是唯一能改这个渠道音色的地方**——应用自己写不进去，原因见下一节。单渠道页叫不开时退到 `ACTION_APP_NOTIFICATION_SETTINGS`（本应用的通知总页），两处都叫不开才弹「打不开通知设置」那条兜底提示。

2026-10-22 之前这一行**一直**在走兜底：action 被写成了 `android.settings.CHANNEL_SETTINGS`，系统里没有任何页面响应它，所以每次都抛 `ActivityNotFoundException`。

### 声音：应用不自带音效，音色归系统渠道页

2026-10-22 起，**这个 App 不再管音色**。曾经的做法是合成一段 0.8 秒的「叮」（`make-sound.mjs` 直出 `res/raw/ding.wav`）写进渠道，在这台小米 15（HyperOS）上实测**永远不响**，方案当天就撤了：现在渠道建出来时挂系统的默认通知音，要换音色去设置页那一行跳过去的渠道页里挑。

三条实测结论，就是这套做法的全部理由：

1. **安卓 8 以后声音绑在渠道上，而且只在创建那一刻有效。** 单条通知里写的 `sound` 会被忽略；一个已经存在的渠道，应用自己也改不动它的声音（对已存在的 id 调 `setSound` + `createNotificationChannel` 是空操作）。所以任何改音色的动作都只能换渠道 id 重来——这就是 id 从 `daily-reminders` / `task-alarms` 一路走到 `-v5` 的原因，也是 `RETIRED_CHANNEL_IDS` 里那八个旧 id 要在启动时删掉的原因（设置页按**名字**列渠道，不清理就会堆成一排同名条目）。
2. **`expo-notifications` 只会写 `android.resource://`，而澎湃对这种应用私有资源 URI 一律消音。** `setNotificationChannelAsync` 的 `sound` 收的是 `res/raw` 里的**文件名**，`SoundResolver` 用 `getIdentifier(name, "raw", packageName)` 查到了才拼成 `android.resource://<包名>/raw/<名字>`，查不到就静默回落成系统默认音、只在控制台打一条 error。消音那一半是 A/B 出来的：dumpsys 里渠道的 `mSound` 完全正确、`mUserLockedFields=0`、通知记录没有 SILENT 标志、SystemUI 也记了 `AlertCoordinator: onViewBound, buzzBeep`（说明系统决定要出声），但 `RingtonePlayer` 就是不出现 `play`。同一台机器上在 ROM 自己的界面里挑一个音，`mSound` 变成 `content://media/...`、字段被锁上，下一条通知立刻响。
3. **AOSP 还会拒掉调用方读不到的 media URI**，所以「应用自己塞一个 `content://media/...` 进去」也走不通——会被改写回 `content://settings/system/notification_sound`。

于是渠道改由原生先建（`NotificationTuningModule.ensureChannel`）：用 `RingtoneManager.getActualDefaultRingtoneUri()` 取系统默认通知音写进去，**抢在 expo 把 `android.resource://` 写进来之前**（声音只在创建时算数）；如果这个渠道的音色已经是你在系统页里手挑的 `content://media/...`，就原样留着不动它。当前两条渠道的状态：

```bash
adb shell dumpsys notification --noredact | grep -o "mId='task-alarms-v5'.*mSound=[^,]*"
# 实测 mSound=content://media/internal/audio/media/260?title=WaterDrop_preview&canonical=1
```

那两个文件（`make-sound.mjs`、`android/app/src/main/res/raw/ding.wav`，连带空掉的 `res/raw/`）已于 2026-10-22 从仓库删除，仓库里不再留任何自绘音效的痕迹。

另外两条踩过的坑记在这儿：`AndroidImportance.MAX`（5）会被 `NotificationChannel` 构造函数拒掉，能出声的上限是 `HIGH`(4)，所以原生那层写了 `coerceIn(1, 4)`；release 构建里 AGP 的 `optimizeReleaseResources` 会缩短资源路径，当时那个 `res/raw/ding.wav` 在 APK 里实际存成 `res/lf.wav` 这种名字，`unzip -l | grep raw/` 查不到不代表没打进去。

### 准点靠 `USE_EXACT_ALARM`

`expo-notifications` 落地 DATE 触发器的地方是 `ExpoSchedulingDelegate.kt` 的 `setupAlarm`：安卓 12 以下、或系统已允许精确闹钟时才走 `setExactAndAllowWhileIdle`，**否则静默退回 `setAndAllowWhileIdle`**，晚十几分钟是正常表现。manifest 里那条 `android.permission.USE_EXACT_ALARM` 是安装即授予的特殊权限（不弹框、用户得去系统设置才看得到），加它就是为了把逐条提醒拨回准点。每日汇总仍然吃 `DAILY` 的非精确闹钟——晚一点不影响什么。

### 每件任务的日历提醒

编辑页滚轮下面那一行「改用系统日历提醒」打开后，保存那一刻会**跳到系统日历的「创建日程」页**，标题、开始、结束都替你填好了（时长固定 30 分钟），你在日历里点右上角 ✓ 才算真的存下这条日程。到点由系统日历负责响；这一条同时会**退出上面的到点通知**（`alarm` 为真就不算可响任务），不会响两遍。

- 开了这一行的任务，行上时间后面跟一个 📅，表示「这条交给日历」。它只表示「要提醒」，**不**表示日历里一定有日程——系统界面不回传结果，App 无从知道你点的是 ✓ 还是 ✗；没带 📅 的行则是由本应用响。
- 完成、删除、把开关关掉再保存，都**取消不了**日历里已经存下的日程，得你自己去日历删。这是走系统写入控件（Intent）换来的代价：不用申请任何日历权限，代价是单向的。
- 选的时间已经过去（比如把今天早些时候的任务改回 06:00）不会静默失败：弹「时间已经过了」，这一行的开关停在关闭，其余改动照常保存。因为时间本身在过去，这条之后也不会由本应用响——过去的时间本来就响不了。
- 系统日历叫不起来时（被卸载、或在 Expo Go / 非安卓环境）弹「日历没能打开」，并把这一行的开关**落回关闭**：它于是变回普通待办，由本应用的到点通知接手。2026-10-22 之前这条路径发的是 `task-alarms` 渠道的一次性兜底通知——现在非日历任务本来就在那条渠道上，兜底等于重复提醒，所以删掉了。

**为什么非得加一个 Kotlin 模块。** 意图本体是 `ACTION_INSERT` + `setDataAndType(Events.CONTENT_URI, "vnd.android.cursor.item/event")`，extras 用 `title` / `description` / `beginTime` / `endTime`。三个坑：

- extras 认的是**常量的字符串值**，不是 Java 常量名：`CalendarContract.EXTRA_EVENT_BEGIN_TIME` 的真身是 `beginTime`（`javap -constants` 读 `android-36/android.jar` 确认）。写成 `android.intent.extra.EVENT_BEGIN_MILLIS` 会被静默忽略，时间回落到「现在」。
- `beginTime` / `endTime` **必须是 long**。同一条意图把毫秒数按字符串传进去，日历照样只显示默认的今天 16:00–17:00。
- RN 的 `Linking.sendIntent` 两条都不满足：它给 `Intent` 挂不上 data/type，还把 JS 数字一律按 **double** 塞进 extras（`node_modules/react-native/ReactAndroid/.../IntentModule.kt` 里自己注释着 "We cannot know from JS if is an Integer or Double"），而日历用 `getLongExtra` 读，类型对不上只能拿默认值。

所以 `android/app/src/main/java/com/demo/androidtodo/SystemCalendarModule.kt` 和 `SystemCalendarPackage.kt` 是必需的，并在 `MainApplication.kt` 的 `PackageList` 里手工 `add(SystemCalendarPackage())`。**`npx expo prebuild` 会重写 `MainApplication.kt`，跑完得把这行加回来。** 2026-10-21 在这台小米 15（HyperOS）实测：不带组件名的隐式意图就能落到 `com.android.calendar/.event.EditEventActivity`，标题、开始、结束、备注四项预填全部生效。

（历史注脚：系统**时钟**那条路 `ACTION_SET_ALARM` 在这台机器上四种 extras 编码全部无效，加 `SKIP_UI=true` 也写不进任何东西，别指望闹钟应用。）

## 应用图标

`assets/app-icon.png`（1254×1254，紫色圆盘主体、四角透明）是唯一源文件，桌面上的 `mipmap-*/ic_launcher.png` 和 `ic_launcher_round.png`（48 / 72 / 96 / 144 / 192）全部由脚本生成：

```powershell
# 在项目根目录执行
powershell -ExecutionPolicy Bypass -File .\make-icons.ps1
```

生成时先把源图铺在 `#5B53F9`（取自圆盘边缘色）纯色底上再缩放，所以桌面遮罩切掉四角后看到的仍是同一个圆盘，不会露出透明边；`app.json` 的 `android.icon` 也指向这张图。

- 模板自带的 `ic_launcher.webp` 已从 `mipmap-*` 移出（仓库里不留 `.webp`）：**同一目录里同名的 `.webp` 和 `.png` 会让 aapt 报重复资源**，两套不能并存。
- 换图流程：替换 `assets/app-icon.png` → 跑一次上面的脚本 → 重新 `assembleRelease`。
- 这条路刻意避开了 `npx expo prebuild`，见下一节关于镜像补丁的说明。

## 打 APK（原生构建）

依赖：JDK 17（Temurin）、Android SDK 的 `platforms;android-36`、`build-tools;36.0.0`、`ndk;27.1.12297006`（RN 0.86 的 `gradle/libs.versions.toml` 里写死了这几个版本）。本机已全部装好。

**`JAVA_HOME` 有可能读不到。** Temurin 的 MSI 确实把它写进了系统环境变量（`HKLM\...\Session Manager\Environment`），但**安装之前就已经开着的终端不会重新读一次**，`gradlew.bat` 又只认 `JAVA_HOME`，于是报 `ERROR: JAVA_HOME is not set...`。新开终端即可；在旧终端里就显式带上：

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17"   # 换成你本机的 JDK 17 目录
.\gradlew.bat -I ..\gradle-mirror.init.gradle -PreactNativeArchitectures=arm64-v8a assembleRelease --console=plain
```

Git Bash 里写成 `JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17" ./gradlew.bat ...`（只对本次命令生效）。注意这条错误**不会**让 `... | tail -30` 整体返回非零，别只看退出码，要确认 APK 的时间戳真的变了。

产物 `android/app/build/outputs/apk/release/app-release.apk`，约 27 MB。装到手机：

```powershell
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

要点：

- **JS 已经打进包里**，装好后可离线运行，不需要再连电脑或开 Metro。验证时不要只看 `BUILD SUCCESSFUL`，解压 APK 确认里面有 `assets/index.android.bundle` 和 `lib/arm64-v8a/*.so` 才算数。
- release 用的是模板自带的调试签名（`android/app/build.gradle` 的 `buildTypes.release` 里 `signingConfig signingConfigs.debug`），自己装没问题；要上架才需要另建 keystore。
- `-I ..\gradle-mirror.init.gradle` 是必需的：本机网络到不了 `registry.npmjs.org`、`services.gradle.org`、`repo.maven.apache.org`、`plugins.gradle.org`（Expo 的云端构建 `expo.dev` 同样连不通），只有阿里 Maven 镜像、腾讯 Gradle 镜像和 `dl.google.com` 可达。该脚本只在带 `-I` 时生效，不写全局配置。同理，`android\gradle\wrapper\gradle-wrapper.properties` 的 `distributionUrl` 已改成腾讯镜像。**重新执行 `npx expo prebuild` 会把这两处覆盖掉，需要重打。**
- `-PreactNativeArchitectures=arm64-v8a` 只编 64 位 ARM，构建更快、包更小；要发给别人装就改成 `arm64-v8a,x86_64`。
- **项目必须待在短的真实路径下。** `expo-modules-core` 的 CMake 对象路径上限是 250 字符，放在 `C:\Users\<用户名>\Documents\...` 这种长前缀下（作者实测 66 字符前缀）会卡在 `ninja: error: manifest 'build.ninja' still dirty after 100 tries`；而用目录联接绕过去也没用——自动链接脚本经 Node 取路径，Node 一定会把联接还原成真实路径。
- 工程根目录一旦变过，先删 `android\app\.cxx` 和 `node_modules\expo\node_modules\expo-modules-core\android\.cxx` 再构建，否则旧 CMake 缓存里记着的长路径会让上面那个错误继续复现。
- 小米等机型上还要在系统设置里允许该应用自启动并取消省电限制，否则到点的提醒可能被系统拦截。
