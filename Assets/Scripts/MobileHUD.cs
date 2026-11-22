using UnityEngine;
using UnityEngine.UI;

public class MobileHUD : MonoBehaviour
{
    [Header("Gameplay references")]
    [SerializeField] private ThirdPersonMobileController playerController;
    [SerializeField] private BasicWeapon weapon;
    [SerializeField] private HealthSystem playerHealth;
    [Header("Buttons")]
    [SerializeField] private Button fireButton;
    [SerializeField] private Button jumpButton;
    [SerializeField] private Button reloadButton;
    [Header("Display")]
    [SerializeField] private Slider healthSlider;
    [SerializeField] private Text healthText;
    [SerializeField] private Text ammoText;

    private void Awake()
    {
        if (fireButton && weapon) fireButton.onClick.AddListener(weapon.Fire);
        if (jumpButton && playerController) jumpButton.onClick.AddListener(playerController.JumpButton);
        if (reloadButton && weapon) reloadButton.onClick.AddListener(weapon.Reload);
        if (healthSlider && playerHealth) { healthSlider.minValue = 0; healthSlider.maxValue = playerHealth.MaxHealth; }
        RefreshHUD();
    }

    private void Update() => RefreshHUD();

    private void RefreshHUD()
    {
        if (playerHealth)
        {
            if (healthSlider) healthSlider.value = playerHealth.CurrentHealth;
            if (healthText) healthText.text = "VIDA " + Mathf.CeilToInt(playerHealth.CurrentHealth) + "/" + Mathf.CeilToInt(playerHealth.MaxHealth);
        }
        if (weapon && ammoText) ammoText.text = "MUNIÇÃO " + weapon.CurrentAmmo + "/" + weapon.MagazineSize;
    }
}
