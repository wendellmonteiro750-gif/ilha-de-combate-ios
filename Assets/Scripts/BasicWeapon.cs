using UnityEngine;
using UnityEngine.Events;

public class BasicWeapon : MonoBehaviour
{
    [Header("Weapon")]
    [SerializeField] private Camera aimCamera;
    [SerializeField] private float damage = 20f;
    [SerializeField] private float range = 120f;
    [SerializeField] private float shotsPerSecond = 5f;
    [SerializeField] private int magazineSize = 30;
    [SerializeField] private float reloadSeconds = 1.6f;
    [SerializeField] private LayerMask hitMask = ~0;
    [Header("Effects")]
    [SerializeField] private ParticleSystem muzzleFlash;
    [SerializeField] private UnityEvent onShot;
    [SerializeField] private UnityEvent onEmpty;
    [SerializeField] private UnityEvent<int, int> onAmmoChanged;

    private int ammo;
    private float nextShotTime;
    private bool reloading;
    public int CurrentAmmo => ammo;
    public int MagazineSize => magazineSize;
    private void Awake() { ammo = magazineSize; onAmmoChanged?.Invoke(ammo, magazineSize); }

    public void Fire()
    {
        if (reloading || Time.time < nextShotTime) return;
        if (ammo <= 0) { onEmpty?.Invoke(); return; }
        nextShotTime = Time.time + 1f / Mathf.Max(0.1f, shotsPerSecond);
        ammo--;
        onAmmoChanged?.Invoke(ammo, magazineSize);
        if (muzzleFlash) muzzleFlash.Play();
        onShot?.Invoke();
        Camera cam = aimCamera ? aimCamera : Camera.main;
        if (cam && Physics.Raycast(cam.transform.position, cam.transform.forward, out RaycastHit hit, range, hitMask, QueryTriggerInteraction.Ignore))
        {
            HealthSystem health = hit.collider.GetComponentInParent<HealthSystem>();
            if (health) health.TakeDamage(damage);
        }
    }

    public void Reload()
    {
        if (!reloading && ammo < magazineSize) StartCoroutine(ReloadRoutine());
    }

    private System.Collections.IEnumerator ReloadRoutine()
    {
        reloading = true;
        yield return new WaitForSeconds(reloadSeconds);
        ammo = magazineSize;
        reloading = false;
        onAmmoChanged?.Invoke(ammo, magazineSize);
    }
}
