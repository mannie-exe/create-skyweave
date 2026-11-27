package audit.animation;

import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

/** Explicit fixture-only normalization experiment; never enabled by the pack. */
public final class OverlayBoneProbe {
    private static final AtomicInteger calls = new AtomicInteger();
    private static final Queue<Map<String, Object>> samples = new ConcurrentLinkedQueue<>();
    private OverlayBoneProbe() {}
    public static boolean enabled() { return Boolean.getBoolean("animationAudit.overlayBoneFix"); }
    public static String result(String raw, String original) {
        String result = enabled() && raw != null ? raw.trim().toLowerCase(Locale.ROOT) : original;
        if (calls.incrementAndGet() <= 256)
            samples.add(Map.of("raw", raw == null ? "<null>" : raw, "original", original,
                "returned", result, "repairEnabled", enabled()));
        return result;
    }
    public static List<Map<String, Object>> samples() { return List.copyOf(samples); }
    public static int calls() { return calls.get(); }
}
